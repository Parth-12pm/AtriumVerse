// Type definitions for all backend API entities

// ==================== User ====================
export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
}

// ==================== Server ====================
export interface Server {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  tilemap_json_path?: string;
  tileset_image_path?: string;
  created_at: string;
}

export interface ServerCreate {
  name: string;
  description?: string;
  tilemap_json_path?: string;
  tileset_image_path?: string;
}

export type MemberStatus = "pending" | "accepted" | "rejected";
export type MemberRole = "owner" | "admin" | "member";

export interface ServerMember {
  id: string;
  server_id: string;
  user_id: string;
  username: string;
  status: MemberStatus;
  role: MemberRole;
  joined_at: string;
}

export interface Zone {
  id: string;
  server_id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  created_at: string;
}

// ==================== Channel ====================
export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: string;
  description?: string;
  position: number;
  created_at: string;
}

export interface ChannelCreate {
  name: string;
  type: string;
  description?: string;
  position?: number;
}

export interface ChannelUpdate {
  name?: string;
  description?: string;
  position?: number;
  type?: string;
}

// ==================== Message ====================
export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  content: string;
  reply_to_id?: string;
  edited_at?: string;
  is_deleted: boolean;
  created_at: string;
}

export interface MessageCreate {
  content: string;
  reply_to_id?: string;
}

export interface MessageUpdate {
  content: string;
}

// ==================== Direct Message ====================
export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  edited_at?: string;
  is_deleted: boolean;
  created_at: string;
  sender_username?: string;
  receiver_username?: string;
}

export interface DirectMessageCreate {
  receiver_id: string;
  content: string;
}

export interface DirectMessageUpdate {
  content: string;
}

export interface Conversation {
  user_id: string;
  username: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

// ==================== API Parameters ====================
export interface MessageListParams {
  limit?: number;
  before?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
