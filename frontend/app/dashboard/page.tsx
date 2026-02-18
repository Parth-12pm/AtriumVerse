"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateServerDialog } from "@/components/dashboard/create-server-dialog";
import { ManageMembersDialog } from "@/components/dashboard/manage-members-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Clock, Video, Users, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  getCharacterById,
  getCharacterPreview,
} from "@/types/advance_char_config";
import Image from "next/image";

interface Server {
  id: string;
  name: string;
  created_at: string;
  owner_id?: string;
  access_type?: "public" | "private";
}

interface RecentServer {
  id: string;
  name: string;
  lastVisited: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [username, setUsername] = useState("User");
  const [userId, setUserId] = useState("");
  const [activeTab, setActiveTab] = useState<"recent" | "created" | "discover">(
    "discover",
  );
  const [mounted, setMounted] = useState(false);
  const [dateString, setDateString] = useState("");
  const [currentCharacter, setCurrentCharacter] = useState<{
    id: string;
    name: string;
    preview: string;
  } | null>(null);
  const [recentServers, setRecentServers] = useState<RecentServer[]>([]);

  const loadServers = async () => {
    try {
      const data = await fetchAPI("/servers/");
      if (Array.isArray(data)) {
        setServers(data);
      }
    } catch {
      toast.error("Failed to load servers");
    }
  };

  // Load recent servers from localStorage
  const loadRecentServers = () => {
    try {
      const stored = localStorage.getItem("recentServers");
      if (stored) {
        const recent: RecentServer[] = JSON.parse(stored);
        // Sort by most recent
        setRecentServers(recent.sort((a, b) => b.lastVisited - a.lastVisited));
      }
    } catch (error) {
      console.error("Failed to load recent servers:", error);
    }
  };

  useEffect(() => {
    setMounted(true);
    setUsername(localStorage.getItem("username") || "User");
    setUserId(localStorage.getItem("user_id") || "");

    // Load character info
    const charId = localStorage.getItem("selectedCharacter") || "bob";
    const char = getCharacterById(charId);
    if (char) {
      setCurrentCharacter({
        id: char.id,
        name: char.name,
        preview: getCharacterPreview(char),
      });
    }

    setDateString(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
    loadServers();
    loadRecentServers();
  }, []);

  const handleJoin = async (e: React.MouseEvent, server: Server) => {
    e.stopPropagation();
    try {
      const res = await fetchAPI(`/servers/${server.id}/join`, {
        method: "POST",
      });

      if (res.status === "accepted" || res.message === "Already a member") {
        // Track as recent server
        trackRecentServer(server.id, server.name);
        router.push(`/server/${server.id}`);
      } else if (
        res.status === "pending" ||
        res.message === "Request sent to owner"
      ) {
        toast.info("Request sent! Waiting for owner approval.");
      } else {
        trackRecentServer(server.id, server.name);
        router.push(`/server/${server.id}`);
      }
    } catch {
      toast.error("Failed to join server");
    }
  };

  const trackRecentServer = (serverId: string, serverName: string) => {
    try {
      const stored = localStorage.getItem("recentServers");
      let recent: RecentServer[] = stored ? JSON.parse(stored) : [];

      // Remove if already exists
      recent = recent.filter((s) => s.id !== serverId);

      // Add to front
      recent.unshift({
        id: serverId,
        name: serverName,
        lastVisited: Date.now(),
      });

      // Keep only last 10
      recent = recent.slice(0, 10);

      localStorage.setItem("recentServers", JSON.stringify(recent));
      setRecentServers(recent);
    } catch (error) {
      console.error("Failed to track recent server:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("user_id");
    router.push("/login");
  };

  const filteredServers = servers.filter((server) => {
    if (activeTab === "created") return server.owner_id === userId;
    if (activeTab === "discover") return server.access_type === "public";
    if (activeTab === "recent") {
      // Show only recent servers
      return recentServers.some((rs) => rs.id === server.id);
    }
    return true;
  });

  // For recent tab, sort by recent order
  const displayServers =
    activeTab === "recent"
      ? filteredServers.sort((a, b) => {
          const aIndex = recentServers.findIndex((rs) => rs.id === a.id);
          const bIndex = recentServers.findIndex((rs) => rs.id === b.id);
          return aIndex - bIndex;
        })
      : filteredServers;

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          {/* Character Preview */}
          {mounted && currentCharacter && (
            <div className="w-16 h-16 border-4 border-black rounded-lg overflow-hidden bg-gray-700">
              <Image
                src={currentCharacter.preview}
                alt={currentCharacter.name}
                width={64}
                height={64}
                className="w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          )}

          <div>
            {mounted && dateString && (
              <Badge className="mb-2 bg-accent text-accent-foreground border-2 border-border">
                {dateString}
              </Badge>
            )}
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              Hi, {mounted ? username : "User"}!
            </h1>
            {mounted && currentCharacter && (
              <p className="text-muted-foreground mt-1">
                Playing as:{" "}
                <span className="font-bold">{currentCharacter.name}</span>
              </p>
            )}
          </div>
        </div>
        <CreateServerDialog />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/10 border-4 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase">
              Active Servers
            </CardTitle>
            <Video className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{servers.length}</div>
            <div className="flex items-center text-xs font-bold mt-2 text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              <span>Available now</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-4 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase">
              Team Members
            </CardTitle>
            <Users className="h-5 w-5" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">--</div>
            <p className="text-xs font-bold mt-2 text-muted-foreground">
              Coming Soon
            </p>
          </CardContent>
        </Card>

        <Card className="bg-secondary border-4 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase">
              Time Active
            </CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">--</div>
            <p className="text-xs font-bold mt-2 text-muted-foreground">
              Coming Soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-4 border-border pb-4">
        <Button
          variant={activeTab === "recent" ? "default" : "neutral"}
          onClick={() => setActiveTab("recent")}
          className="font-bold"
        >
          Recent
        </Button>
        <Button
          variant={activeTab === "discover" ? "default" : "neutral"}
          onClick={() => setActiveTab("discover")}
          className="font-bold"
        >
          Discover
        </Button>
        <Button
          variant={activeTab === "created" ? "default" : "neutral"}
          onClick={() => setActiveTab("created")}
          className="font-bold"
        >
          My Servers
        </Button>
      </div>

      {/* Spaces Grid */}
      {displayServers.length === 0 ? (
        <Card className="border-4 border-border border-dashed p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-lg border-2 border-border flex items-center justify-center">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-black uppercase">
              {activeTab === "recent" ? "No Recent Servers" : "No Servers Yet"}
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {activeTab === "created"
                ? "You haven't created any servers yet."
                : activeTab === "recent"
                  ? "Visit some servers to see them here."
                  : "No public servers found."}
            </p>
            {activeTab === "created" && <CreateServerDialog />}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayServers.map((server) => {
            const recentInfo = recentServers.find((rs) => rs.id === server.id);
            return (
              <Card
                key={server.id}
                className="border-4 border-border hover:shadow-shadow hover:-translate-x-1 hover:-translate-y-1 transition-all cursor-pointer group"
                onClick={(e) => handleJoin(e, server)}
              >
                <div className="h-32 bg-gradient-to-br from-primary/20 to-accent/20 border-b-4 border-border flex items-center justify-center relative">
                  {server.access_type === "private" && (
                    <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 text-xs rounded font-bold">
                      PRIVATE
                    </div>
                  )}
                  <Video className="w-12 h-12 text-primary/50" />
                </div>
                <CardContent className="p-4">
                  <h3 className="text-lg font-black uppercase truncate">
                    {server.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "recent" && recentInfo
                      ? `Last visited: ${getTimeAgo(recentInfo.lastVisited)}`
                      : server.created_at
                        ? new Date(server.created_at).toLocaleDateString()
                        : "Just now"}
                  </p>
                  <div className="flex flex-col gap-2 mt-4">
                    <Button
                      className="w-full font-bold group-hover:bg-primary"
                      variant="neutral"
                      onClick={(e) => handleJoin(e, server)}
                    >
                      {server.access_type === "private"
                        ? "Request Access"
                        : "Enter Server"}
                    </Button>

                    {server.owner_id === userId && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ManageMembersDialog serverId={server.id} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
