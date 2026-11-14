
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

let authToken = localStorage.getItem("quickchat_token");

export function setToken(token) {
  authToken = token;

  if (token) {
    localStorage.setItem("quickchat_token", token);
  } else {
    localStorage.removeItem("quickchat_token");
  }
}

export function getToken() {
  return authToken;
}

export async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
    }

    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

export const api = {
  register: (details) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(details)
    }),

  login: (details) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(details)
    }),

  me: () => apiRequest("/auth/me"),

  searchUsers: (username) =>
    apiRequest(`/users/search?username=${encodeURIComponent(username)}`),

  getGroups: () => apiRequest("/groups"),

  getGroup: (id) => apiRequest(`/groups/${id}`),

  updateGroup: (groupId, details) =>
  apiRequest(`/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(details)
  }),

  createGroup: (details) =>
    apiRequest("/groups", {
      method: "POST",
      body: JSON.stringify(details)
    }),

  addMember: (groupId, username) =>
    apiRequest(`/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ username })
    }),

  removeMember: (groupId, userId) =>
    apiRequest(`/groups/${groupId}/members/${userId}`, {
      method: "DELETE"
    }),
  
  transferAdmin: (groupId, newAdminId) =>
    apiRequest(`/groups/${groupId}/admin`, {
     method: "PATCH",
     body: JSON.stringify({ newAdminId })
    }
  ),

  leaveGroup: (groupId) =>
    apiRequest(`/groups/${groupId}/leave`, {
      method: "POST"
    }),

  deleteGroup: (groupId) =>
    apiRequest(`/groups/${groupId}`, {
      method: "DELETE"
    }),

  getMessages: (groupId) =>
    apiRequest(`/groups/${groupId}/messages?limit=50`),

  sendMessage: (groupId, text) =>
    apiRequest(`/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text })
    }),
  
  deleteMessage: (groupId, messageId) =>
  apiRequest(`/groups/${groupId}/messages/${messageId}`, {
    method: "DELETE"
  })
  
  
};
