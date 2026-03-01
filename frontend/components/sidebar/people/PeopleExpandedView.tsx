"use client";

import { useState, useEffect } from "react";
import { X, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import EventBus, { GameEvents } from "@/game/EventBus";
import { serversAPI } from "@/lib/services/api.service";
import type { ServerMember } from "@/types/api.types";

interface PeopleExpandedViewProps {
  serverId: string;
  onClose: () => void;
  onStartDM?: (userId: string, username: string) => void;
}

interface OnlineUser {
  id: string;
  username: string;
  status: "online" | "away" | "busy";
  x: number;
  y: number;
}

export default function PeopleExpandedView({
  serverId,
  onClose,
  onStartDM,
}: PeopleExpandedViewProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [serverMembers, setServerMembers] = useState<ServerMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Load server members from backend
  useEffect(() => {
    loadMembers();
  }, [serverId]);

  const loadMembers = async () => {
    try {
      const response = await serversAPI.listMembers(serverId);
      setServerMembers(response.data);
    } catch (error) {
      console.error("Failed to load server members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Listen to EventBus for user updates
    const handleUserListUpdate = (users: any[]) => {
      const userObjects = users.map((u) => ({
        id: u.user_id,
        username: u.username || "Player",
        status: "online" as const,
        x: u.x || 0,
        y: u.y || 0,
      }));

      // Merge with existing users instead of replacing
      setOnlineUsers((prev) => {
        const userMap = new Map(prev.map((u) => [u.id, u]));
        userObjects.forEach((user) => {
          userMap.set(user.id, user);
        });
        return Array.from(userMap.values());
      });
    };

    const handleRemoteMove = (data: {
      userId: string;
      x: number;
      y: number;
    }) => {
      setOnlineUsers((prev) =>
        prev.map((u) =>
          u.id === data.userId ? { ...u, x: data.x, y: data.y } : u,
        ),
      );
    };

    const handleUserLeft = (data: { user_id: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== data.user_id));
    };

    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handleUserListUpdate);
    EventBus.on(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);
    EventBus.on(GameEvents.PLAYER_LEFT, handleUserLeft);

    // Request current user list when component mounts
    EventBus.emit(GameEvents.REQUEST_USER_LIST);

    return () => {
      EventBus.off(GameEvents.PLAYER_LIST_UPDATE, handleUserListUpdate);
      EventBus.off(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);
      EventBus.off(GameEvents.PLAYER_LEFT, handleUserLeft);
    };
  }, []);

  return (
    <div className="fixed  pl-19 w-[400px] top-0 h-full w-64 bg-white border-r-4 border-black z-40 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b-4 border-black bg-purple-500 flex items-center justify-between">
        <h2 className="text-lg font-black text-white">People</h2>
        <Button
          onClick={onClose}
          variant="neutral"
          size="icon"
          className="h-8 w-8 bg-white hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {onlineUsers.map((user) => {
            const currentUserId = localStorage.getItem("user_id");
            const isCurrentUser = user.id === currentUserId;

            return (
              <div
                key={user.id}
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                  isCurrentUser
                    ? "bg-purple-50"
                    : "hover:bg-gray-100 cursor-pointer"
                }`}
                onClick={() => {
                  if (!isCurrentUser) {
                    if (onStartDM) {
                      onStartDM(user.id, user.username);
                    } else {
                      EventBus.emit("dm:start", {
                        userId: user.id,
                        username: user.username,
                      });
                      onClose();
                    }
                  }
                }}
              >
                <Avatar className="w-8 h-8 border-2 border-black">
                  <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white font-black text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {user.username}
                    {isCurrentUser && (
                      <span className="text-xs text-gray-500 ml-1">(you)</span>
                    )}
                  </p>
                </div>
                <div
                  className={`w-2 h-2 rounded-full ${
                    user.status === "online"
                      ? "bg-green-500"
                      : user.status === "away"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
              </div>
            );
          })}
          {onlineUsers.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-bold text-gray-400">No users online</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t-2 border-black bg-gray-50">
        <p className="text-xs text-gray-500 text-center font-bold">
          {onlineUsers.length} online
        </p>
      </div>
    </div>
  );
}
