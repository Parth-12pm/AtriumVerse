"use client";

import { useState, useEffect } from "react";
import { X, Users, MapPin } from "lucide-react";
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
    <div className="fixed left-16 top-0 h-full w-80 bg-white border-r-4 border-black z-40 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b-4 border-black bg-purple-500 flex items-center justify-between">
        <h2 className="text-xl font-black text-white">People</h2>
        <Button
          onClick={onClose}
          variant="neutral"
          size="icon"
          className="bg-white hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {onlineUsers.map((user) => {
            const currentUserId = localStorage.getItem("user_id");
            const isCurrentUser = user.id === currentUserId;

            return (
              <div
                key={user.id}
                className={`flex items-center gap-3 p-3 bg-gray-50 border-2 border-black rounded-lg transition-colors ${
                  isCurrentUser ? "" : "hover:bg-gray-100 cursor-pointer"
                }`}
                onClick={() => {
                  if (!isCurrentUser) {
                    // Use callback if provided, otherwise emit event
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
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white font-black">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm truncate">
                    {user.username}{" "}
                    {isCurrentUser && (
                      <span className="text-gray-500">(you)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span>
                      ({user.x}, {user.y})
                    </span>
                  </div>
                </div>
                <div
                  className={`w-3 h-3 rounded-full border-2 border-black ${
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
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-bold text-gray-500">No users online</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t-4 border-black bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          {onlineUsers.length} user{onlineUsers.length !== 1 ? "s" : ""} online
        </p>
      </div>
    </div>
  );
}
