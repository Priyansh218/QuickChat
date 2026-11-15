
const { v4: uuid } = require("uuid");

const {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
  BatchWriteCommand
} = require("@aws-sdk/lib-dynamodb");

const dynamodb = require("./dynamodb");

const USERS = "QuickChatUsers";
const GROUPS = "QuickChatGroups";
const MEMBERSHIPS = "QuickChatMemberships";
const MESSAGES = "QuickChatMessages";

const usernameKey = username => username.trim().toLowerCase();

function mapUser(item) {
  if (!item) return null;

  const { userID, ...rest } = item;
  return { ...rest, id: userID };
}

function mapGroup(item) {
  if (!item) return null;

  const { groupId, ...rest } = item;
  return { ...rest, id: groupId };
}

function mapMessage(item) {
  if (!item) return null;

  const { messageId, ...rest } = item;
  return { ...rest, id: messageId };
}

async function queryAll(params) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const result = await dynamodb.send(new QueryCommand({
      ...params,
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {})
    }));

    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

async function batchDelete(table, items, keyNames) {
  for (let i = 0; i < items.length; i += 25) {
    let pending = items.slice(i, i + 25).map(item => ({
      DeleteRequest: {
        Key: Object.fromEntries(
          keyNames.map(key => [key, item[key]])
        )
      }
    }));

    let attempts = 0;

    while (pending.length && attempts < 5) {
      const result = await dynamodb.send(new BatchWriteCommand({
        RequestItems: { [table]: pending }
      }));

      pending = result.UnprocessedItems?.[table] || [];
      attempts++;
    }

    if (pending.length) {
      throw new Error("BATCH_DELETE_INCOMPLETE");
    }
  }
}

const store = {
  // USERS

  async createUser(user) {
    const newUser = {
      userID: uuid(),
      fullName: user.fullName,
      username: usernameKey(user.username),
      userType: "USER",
      passwordHash: user.passwordHash,
      createdAt: new Date().toISOString()
    };

    try {
      await dynamodb.send(new PutCommand({
        TableName: USERS,
        Item: newUser,
        ConditionExpression: "attribute_not_exists(username)"
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        throw new Error("USERNAME_EXISTS");
      }
      throw error;
    }

    return mapUser(newUser);
  },

  async getUserByUsername(username) {
    const result = await dynamodb.send(new GetCommand({
      TableName: USERS,
      Key: { username: usernameKey(username) }
    }));

    return mapUser(result.Item);
  },

  async getUserById(id) {
    const result = await dynamodb.send(new QueryCommand({
      TableName: USERS,
      IndexName: "userId-index",
      KeyConditionExpression: "userID = :id",
      ExpressionAttributeValues: { ":id": id },
      Limit: 1
    }));

    return mapUser(result.Items?.[0]);
  },

  async searchUsers(username, currentUserId) {
    const prefix = usernameKey(username);

    const result = await dynamodb.send(new QueryCommand({
      TableName: USERS,
      IndexName: "username-prefix-index",
      KeyConditionExpression:
        "userType = :type AND begins_with(username, :prefix)",
      ExpressionAttributeValues: {
        ":type": "USER",
        ":prefix": prefix
      },
      Limit: 50
    }));

    return (result.Items || [])
      .filter(user => user.userID !== currentUserId)
      .slice(0, 10)
      .map(user => ({
        id: user.userID,
        fullName: user.fullName,
        username: user.username
      }));
  },

  // GROUPS

  async createGroup({ name, description, creatorId, memberIds }) {
    const groupId = uuid();
    const now = new Date().toISOString();

    const group = {
      groupId,
      name,
      description: description || "",
      createdBy: creatorId,
      createdAt: now
    };

    const allMembers = [...new Set([creatorId, ...memberIds])];

    const transactItems = [
      {
        Put: {
          TableName: GROUPS,
          Item: group,
          ConditionExpression: "attribute_not_exists(groupId)"
        }
      },
      ...allMembers.map(userId => ({
        Put: {
          TableName: MEMBERSHIPS,
          Item: {
            groupId,
            userId,
            role: userId === creatorId ? "admin" : "member",
            joinedAt: now
          },
          ConditionExpression:
            "attribute_not_exists(groupId) AND attribute_not_exists(userId)"
        }
      }))
    ];

    await dynamodb.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    return mapGroup(group);
  },

  async getGroup(groupId) {
    const result = await dynamodb.send(new GetCommand({
      TableName: GROUPS,
      Key: { groupId }
    }));

    return mapGroup(result.Item);
  },

  async updateGroup(groupId, { name, description }) {
    const result = await dynamodb.send(new UpdateCommand({
      TableName: GROUPS,
      Key: { groupId },
      UpdateExpression:
        "SET #name = :name, description = :description, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: {
        ":name": name,
        ":description": description,
        ":updatedAt": new Date().toISOString()
      },
      ConditionExpression: "attribute_exists(groupId)",
      ReturnValues: "ALL_NEW"
    }));

    return mapGroup(result.Attributes);
  },

  async getMembership(groupId, userId) {
    const result = await dynamodb.send(new GetCommand({
      TableName: MEMBERSHIPS,
      Key: { groupId, userId }
    }));

    return result.Item || null;
  },

  async getGroupMembers(groupId) {
    const memberships = await queryAll({
      TableName: MEMBERSHIPS,
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: { ":groupId": groupId }
    });

    const members = await Promise.all(
      memberships.map(async item => {
        const user = await this.getUserById(item.userId);

        return user ? {
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          role: item.role,
          joinedAt: item.joinedAt
        } : null;
      })
    );

    return members.filter(Boolean);
  },

  async getUserGroups(userId) {
    const memberships = await queryAll({
      TableName: MEMBERSHIPS,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId }
    });

    const groups = await Promise.all(
      memberships.map(async item => {
        const group = await this.getGroup(item.groupId);
        if (!group) return null;

        const members = await this.getGroupMembers(group.id);

        return {
          ...group,
          role: item.role,
          memberCount: members.length
        };
      })
    );

    return groups.filter(Boolean);
  },

  async addMember(groupId, userId) {
    try {
      await dynamodb.send(new PutCommand({
        TableName: MEMBERSHIPS,
        Item: {
          groupId,
          userId,
          role: "member",
          joinedAt: new Date().toISOString()
        },
        ConditionExpression:
          "attribute_not_exists(groupId) AND attribute_not_exists(userId)"
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        throw new Error("ALREADY_MEMBER");
      }
      throw error;
    }
  },

  async removeMember(groupId, userId) {
    await dynamodb.send(new DeleteCommand({
      TableName: MEMBERSHIPS,
      Key: { groupId, userId }
    }));
  },

  async transferAdmin(groupId, currentAdminId, newAdminId) {
    if (currentAdminId === newAdminId) {
      throw new Error("SAME_ADMIN");
    }

    const currentAdmin = await this.getMembership(groupId, currentAdminId);
    const newAdmin = await this.getMembership(groupId, newAdminId);

    if (!currentAdmin || currentAdmin.role !== "admin") {
      throw new Error("NOT_CURRENT_ADMIN");
    }

    if (!newAdmin) {
      throw new Error("TARGET_NOT_MEMBER");
    }

    await dynamodb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: MEMBERSHIPS,
            Key: { groupId, userId: currentAdminId },
            UpdateExpression: "SET #role = :member",
            ExpressionAttributeNames: { "#role": "role" },
            ExpressionAttributeValues: { ":member": "member" },
            ConditionExpression: "#role = :admin"
          }
        },
        {
          Update: {
            TableName: MEMBERSHIPS,
            Key: { groupId, userId: newAdminId },
            UpdateExpression: "SET #role = :admin",
            ExpressionAttributeNames: { "#role": "role" },
            ExpressionAttributeValues: { ":admin": "admin" },
            ConditionExpression: "attribute_exists(groupId)"
          }
        }
      ]
    }));
  },

  async deleteGroup(groupId) {
    const [memberships, messages] = await Promise.all([
      queryAll({
        TableName: MEMBERSHIPS,
        KeyConditionExpression: "groupId = :groupId",
        ExpressionAttributeValues: { ":groupId": groupId }
      }),
      queryAll({
        TableName: MESSAGES,
        KeyConditionExpression: "groupId = :groupId",
        ExpressionAttributeValues: { ":groupId": groupId }
      })
    ]);

    await batchDelete(
      MEMBERSHIPS,
      memberships,
      ["groupId", "userId"]
    );

    await batchDelete(
      MESSAGES,
      messages,
      ["groupId", "messageId"]
    );

    await dynamodb.send(new DeleteCommand({
      TableName: GROUPS,
      Key: { groupId }
    }));
  },

  // MESSAGES

  async addMessage(message) {
    const newMessage = {
      groupId: message.groupId,
      messageId: uuid(),
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      createdAt: new Date().toISOString()
    };

    await dynamodb.send(new PutCommand({
      TableName: MESSAGES,
      Item: newMessage
    }));

    return mapMessage(newMessage);
  },

  async getMessages(groupId, limit = 50, before) {
    const result = await dynamodb.send(new QueryCommand({
      TableName: MESSAGES,
      IndexName: "groupId-createdAt-index",
      KeyConditionExpression: before
        ? "groupId = :groupId AND createdAt < :before"
        : "groupId = :groupId",
      ExpressionAttributeValues: before
        ? { ":groupId": groupId, ":before": before }
        : { ":groupId": groupId },
      ScanIndexForward: false,
      Limit: limit
    }));

    return (result.Items || []).reverse().map(mapMessage);
  },

  async getMessage(groupId, messageId) {
    const result = await dynamodb.send(new GetCommand({
      TableName: MESSAGES,
      Key: { groupId, messageId }
    }));

    return mapMessage(result.Item);
  },

  async deleteMessage(groupId, messageId) {
    const existing = await this.getMessage(groupId, messageId);
    if (!existing) return false;

    await dynamodb.send(new DeleteCommand({
      TableName: MESSAGES,
      Key: { groupId, messageId }
    }));

    return true;
  }
};

module.exports = store;
