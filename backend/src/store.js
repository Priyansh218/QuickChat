
const { v4: uuid } = require("uuid");
const fs = require("fs");
const path = require("path");

// Persistent database location: backend/data/db.json
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const users = new Map();
const groups = new Map();
const memberships = new Map();
const messages = new Map();

const usernameKey = (username) => username.toLowerCase();

// Save all collections to the JSON file
function saveDatabase() {
  const data = {
    users: [...users.values()],
    groups: [...groups.values()],
    memberships: [...memberships.values()],
    messages: Object.fromEntries(messages)
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const tempFile = `${DB_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, DB_FILE);
}

// Load existing data when the backend starts
function loadDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DB_FILE)) {
    saveDatabase();
    return;
  }

  const rawData = fs.readFileSync(DB_FILE, "utf8");
  const data = JSON.parse(rawData);

  for (const user of data.users || []) {
    users.set(usernameKey(user.username), user);
  }

  for (const group of data.groups || []) {
    groups.set(group.id, group);
  }

  for (const membership of data.memberships || []) {
    memberships.set(
      `${membership.groupId}:${membership.userId}`,
      membership
    );
  }

  for (const [groupId, groupMessages] of Object.entries(
    data.messages || {}
  )) {
    messages.set(groupId, groupMessages);
  }
}

// Initialize storage before the routes use it
loadDatabase();

const store = {
  // USERS
  createUser(user) {
    const key = usernameKey(user.username);

    if (users.has(key)) {
      throw new Error("USERNAME_EXISTS");
    }

    const newUser = {
      id: uuid(),
      fullName: user.fullName,
      username: key,
      passwordHash: user.passwordHash,
      createdAt: new Date().toISOString()
    };

    users.set(key, newUser);
    saveDatabase();

    return newUser;
  },

  getUserByUsername(username) {
    return users.get(usernameKey(username)) || null;
  },

  getUserById(id) {
    return [...users.values()].find(user => user.id === id) || null;
  },

  searchUsers(username, currentUserId) {
    const query = usernameKey(username);

    return [...users.values()]
      .filter(user =>
        user.id !== currentUserId &&
        user.username.includes(query)
      )
      .slice(0, 10)
      .map(({ id, fullName, username }) => ({
        id, fullName, username
      }));
  },

  // GROUPS
  createGroup({ name, description, creatorId, memberIds }) {
    const groupId = uuid();
    const now = new Date().toISOString();

    const group = {
      id: groupId,
      name,
      description: description || "",
      createdBy: creatorId,
      createdAt: now
    };

    groups.set(groupId, group);

    const allMembers = [...new Set([creatorId, ...memberIds])];

    allMembers.forEach(userId => {
      memberships.set(`${groupId}:${userId}`, {
        groupId,
        userId,
        role: userId === creatorId ? "admin" : "member",
        joinedAt: now
      });
    });

    saveDatabase();

    return group;
  },

  getGroup(groupId) {
    return groups.get(groupId) || null;
  },

  updateGroup(groupId, { name, description }) {
   const group = groups.get(groupId);
 
   if (!group) {
     throw new Error("GROUP_NOT_FOUND");
   }
 
   group.name = name;
   group.description = description;
   group.updatedAt = new Date().toISOString();
 
   groups.set(groupId, group);
   saveDatabase();
 
   return group;
  },

  getMembership(groupId, userId) {
    return memberships.get(`${groupId}:${userId}`) || null;
  },

  getGroupMembers(groupId) {
    return [...memberships.values()]
      .filter(item => item.groupId === groupId)
      .map(item => {
        const user = this.getUserById(item.userId);

        return user ? {
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          role: item.role,
          joinedAt: item.joinedAt
        } : null;
      })
      .filter(Boolean);
  },

  getUserGroups(userId) {
    return [...memberships.values()]
      .filter(item => item.userId === userId)
      .map(item => {
        const group = groups.get(item.groupId);

        if (!group) return null;

        return {
          ...group,
          role: item.role,
          memberCount: this.getGroupMembers(group.id).length
        };
      })
      .filter(Boolean);
  },

  addMember(groupId, userId) {
    const key = `${groupId}:${userId}`;

    if (memberships.has(key)) {
      throw new Error("ALREADY_MEMBER");
    }

    memberships.set(key, {
      groupId,
      userId,
      role: "member",
      joinedAt: new Date().toISOString()
    });

    saveDatabase();
  },

  removeMember(groupId, userId) {
    memberships.delete(`${groupId}:${userId}`);
    saveDatabase();
  },

  // TRANSFER ADMIN
  transferAdmin(groupId, currentAdminId, newAdminId) {
    const currentAdminKey = `${groupId}:${currentAdminId}`;
    const newAdminKey = `${groupId}:${newAdminId}`;

    const currentAdmin = memberships.get(currentAdminKey);
    const newAdmin = memberships.get(newAdminKey);

    if (!currentAdmin || currentAdmin.role !== "admin") {
      throw new Error("NOT_CURRENT_ADMIN");
    }

    if (!newAdmin) {
      throw new Error("TARGET_NOT_MEMBER");
    }

    if (currentAdminId === newAdminId) {
      throw new Error("SAME_ADMIN");
    }

    currentAdmin.role = "member";
    newAdmin.role = "admin";

    memberships.set(currentAdminKey, currentAdmin);
    memberships.set(newAdminKey, newAdmin);

    saveDatabase();
  },

  deleteGroup(groupId) {
    groups.delete(groupId);

    for (const [key, membership] of memberships) {
      if (membership.groupId === groupId) {
        memberships.delete(key);
      }
    }

    messages.delete(groupId);

    saveDatabase();
  },

  
  // MESSAGES
  addMessage(message) {
    const newMessage = {
      id: uuid(),
      ...message,
      createdAt: new Date().toISOString()
    };

    const groupMessages = messages.get(message.groupId) || [];

    groupMessages.push(newMessage);
    messages.set(message.groupId, groupMessages);

    saveDatabase();

    return newMessage;
  },

  getMessages(groupId, limit = 50, before) {
    let result = messages.get(groupId) || [];

    if (before) {
      result = result.filter(
        message => message.createdAt < before
      );
    }

    return result.slice(-limit);
  },

  getMessage(groupId, messageId) {
    const groupMessages = messages.get(groupId) || [];

    return groupMessages.find(
      message => message.id === messageId
    ) || null;
  },

  deleteMessage(groupId, messageId) {
    const groupMessages = messages.get(groupId) || [];

    const updatedMessages = groupMessages.filter(
      message => message.id !== messageId
    );

    if (updatedMessages.length === groupMessages.length) {
      return false;
    }

    messages.set(groupId, updatedMessages);
    saveDatabase();

    return true;
  }
};

module.exports = store;
