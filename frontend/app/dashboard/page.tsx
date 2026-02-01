"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateRoomDialog } from "@/components/dashboard/create-room-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Clock, Video, Users, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Room {
  id: string;
  name: string;
  created_at: string;
  host_id?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [username, setUsername] = useState("User");
  const [activeTab, setActiveTab] = useState<"recent" | "created">("recent");
  const [mounted, setMounted] = useState(false);
  const [dateString, setDateString] = useState("");

  useEffect(() => {
    setMounted(true);
    setUsername(localStorage.getItem("username") || "User");
    // Format date client-side only to avoid hydration mismatch
    setDateString(new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }));
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const data = await fetchAPI("/rooms/");
      if (Array.isArray(data)) {
        setRooms(data);
      }
    } catch (error) {
      toast.error("Failed to load rooms");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          {mounted && dateString && (
            <Badge className="mb-2 bg-accent text-accent-foreground border-2 border-border">
              {dateString}
            </Badge>
          )}
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Hi, {mounted ? username : "User"}!
          </h1>
          <p className="text-muted-foreground mt-1">Ready to collaborate?</p>
        </div>
        <CreateRoomDialog />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/10 border-4 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase">Active Spaces</CardTitle>
            <Video className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{rooms.length}</div>
            <div className="flex items-center text-xs font-bold mt-2 text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              <span>Available now</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-4 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase">Team Members</CardTitle>
            <Users className="h-5 w-5" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">--</div>
            <p className="text-xs font-bold mt-2 text-muted-foreground">Coming Soon</p>
          </CardContent>
        </Card>

        <Card className="bg-secondary border-4 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase">Time Active</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">--</div>
            <p className="text-xs font-bold mt-2 text-muted-foreground">Coming Soon</p>
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
          Last Visited
        </Button>
        <Button
          variant={activeTab === "created" ? "default" : "neutral"}
          onClick={() => setActiveTab("created")}
          className="font-bold"
        >
          Created Spaces
        </Button>
      </div>

      {/* Spaces Grid */}
      {rooms.length === 0 ? (
        <Card className="border-4 border-border border-dashed p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-lg border-2 border-border flex items-center justify-center">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-black uppercase">No Spaces Yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Create your first virtual space and invite your team to collaborate.
            </p>
            <CreateRoomDialog />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <Card
              key={room.id}
              className="border-4 border-border hover:shadow-shadow hover:-translate-x-1 hover:-translate-y-1 transition-all cursor-pointer group"
              onClick={() => router.push(`/room-grid/${room.id}`)}
            >
              {/* Preview Image Placeholder */}
              <div className="h-32 bg-gradient-to-br from-primary/20 to-accent/20 border-b-4 border-border flex items-center justify-center">
                <Video className="w-12 h-12 text-primary/50" />
              </div>
              <CardContent className="p-4">
                <h3 className="text-lg font-black uppercase truncate">{room.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(room.created_at).toLocaleDateString()}
                </p>
                <Button
                  className="w-full mt-4 font-bold group-hover:bg-primary"
                  variant="neutral"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/room-grid/${room.id}`);
                  }}
                >
                  Enter Space
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
