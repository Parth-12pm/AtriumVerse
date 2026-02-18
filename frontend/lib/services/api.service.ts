import { apiClient } from "../api";
import type {
  UserCreate,
  LoginResponse,
  ServerCreate,
  ChannelCreate,
  ChannelUpdate,
  MessageCreate,
  MessageUpdate,
  MessageListParams,
  DirectMessageCreate,
  DirectMessageUpdate,
} from "@/types/api.types";

// ==================== Auth API ====================
export const authAPI = {
  register: async (data: UserCreate) => {
    return apiClient.post("/register", data);
  },

  login: async (username: string, password: string) => {
    // Backend expects form data for OAuth2
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Login failed");
    }

    return response.json() as Promise<LoginResponse>;
  },
};

// ==================== Servers API ====================
export const serversAPI = {
  list: async () => {
    return apiClient.get("/servers");
  },

  create: async (data: ServerCreate) => {
    return apiClient.post("/servers", data);
  },

  get: async (serverId: string) => {
    return apiClient.get(`/servers/${serverId}`);
  },

  join: async (serverId: string) => {
    return apiClient.post(`/servers/${serverId}/join`, {});
  },

  getZones: async (serverId: string) => {
    return apiClient.get(`/servers/${serverId}/zones`);
  },

  listMembers: async (serverId: string) => {
    return apiClient.get(`/servers/${serverId}/members`);
  },

  approveMember: async (serverId: string, userId: string) => {
    return apiClient.post(`/servers/${serverId}/members/${userId}/approve`, {});
  },

  rejectMember: async (serverId: string, userId: string) => {
    return apiClient.delete(`/servers/${serverId}/members/${userId}`);
  },

  leave: async (serverId: string) => {
    return apiClient.post(`/servers/${serverId}/leave`, {});
  },
};

// ==================== Channels API ====================
export const channelsAPI = {
  list: async (serverId: string) => {
    return apiClient.get(`/channels/${serverId}/channels`);
  },

  create: async (serverId: string, data: ChannelCreate) => {
    return apiClient.post(`/channels/${serverId}/channels`, data);
  },

  update: async (channelId: string, data: ChannelUpdate) => {
    return apiClient.patch(`/channels/channels/${channelId}`, data);
  },

  delete: async (channelId: string) => {
    return apiClient.delete(`/channels/channels/${channelId}`);
  },
};

// ==================== Messages API ====================
export const messagesAPI = {
  list: async (channelId: string, params?: MessageListParams) => {
    return apiClient.get(`/messages/channels/${channelId}/messages`, {
      params,
    });
  },

  send: async (channelId: string, data: MessageCreate) => {
    return apiClient.post(`/messages/channels/${channelId}/messages`, data);
  },

  edit: async (messageId: string, data: MessageUpdate) => {
    return apiClient.patch(`/messages/messages/${messageId}`, data);
  },

  delete: async (messageId: string) => {
    return apiClient.delete(`/messages/messages/${messageId}`);
  },
};

// ==================== Direct Messages API ====================
export const directMessagesAPI = {
  listConversations: async () => {
    return apiClient.get("/DM/conversations");
  },

  getMessages: async (userId: string, params?: MessageListParams) => {
    return apiClient.get(`/DM/messages/${userId}`, {
      params,
    });
  },

  send: async (data: DirectMessageCreate) => {
    return apiClient.post("/DM/messages", data);
  },

  edit: async (messageId: string, data: DirectMessageUpdate) => {
    return apiClient.patch(`/DM/messages/${messageId}`, data);
  },

  delete: async (messageId: string) => {
    return apiClient.delete(`/DM/messages/${messageId}`);
  },
};
