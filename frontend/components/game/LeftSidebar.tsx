"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Search, 
  Users, 
  Settings, 
  Menu,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  UserPlus
} from "lucide-react";

interface User {
  id: string;
  username: string;
  status: "online" | "away" | "busy";
}

interface LeftSidebarProps {
  users: User[];
  onInvite?: () => void;
  roomName?: string;
}

export function LeftSidebar({ users, onInvite, roomName = "Space" }: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (collapsed) {
    return (
      <div className="w-12 h-full bg-card border-r-4 border-border flex flex-col items-center py-4 gap-4">
        <Button
          variant="neutral"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="hover:bg-primary/20"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Users className="h-4 w-4 text-primary-foreground" />
        </div>
        <Button variant="neutral" size="icon" className="hover:bg-primary/20">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="neutral" size="icon" className="hover:bg-primary/20">
          <MessageSquare className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button variant="neutral" size="icon" className="hover:bg-primary/20">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-card border-r-4 border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b-4 border-border flex items-center justify-between">
        <span className="font-black uppercase text-sm truncate">{roomName}</span>
        <Button
          variant="neutral"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="hover:bg-primary/20 h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Invite Section */}
      <div className="p-4 border-b-4 border-border bg-primary/5">
        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">
          Experience together
        </p>
        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-primary/30 border-2 border-border"
            />
          ))}
        </div>
        <Button
          onClick={onInvite}
          className="w-full font-bold"
          size="sm"
        >
          <UserPlus className="h-4 w-4 mr-2" /> Invite
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b-4 border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-2 h-9 text-sm"
          />
        </div>
      </div>

      {/* Online Users */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-xs font-bold uppercase text-muted-foreground mb-3">
          Online
        </p>
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors"
            >
              <div className="relative">
                <Avatar className="h-8 w-8 border-2 border-border">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    user.status === "online"
                      ? "bg-green-500"
                      : user.status === "away"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t-4 border-border">
        <Button variant="neutral" className="w-full justify-start font-bold" size="sm">
          <Settings className="h-4 w-4 mr-2" /> Settings
        </Button>
      </div>
    </div>
  );
}
