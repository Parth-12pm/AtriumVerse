"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, use } from "react";
import BaseSidebar from "@/components/sidebar/BaseSidebar";
import ProximityChat from "@/components/game/ProximityChat";
import ServerDock from "@/components/navigation/ServerDock";
import CharacterSelector from "@/components/game/CharacterSelector";
import { Button } from "@/components/ui/button";

const GameWrapper = dynamic(() => import("@/components/game/GameWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary rounded-lg border-4 border-border shadow-shadow animate-pulse mx-auto mb-4" />
        <p className="font-bold uppercase">Loading Space...</p>
      </div>
    </div>
  ),
});

interface ServerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ServerPage({ params }: ServerPageProps) {
  const { id: serverId } = use(params);

  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("Player");
  const [token, setToken] = useState("");
  const [mounted, setMounted] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("bob");
  // The backend map_path for this server (e.g. "phaser_assets/maps/map1.json")
  const [mapPath, setMapPath] = useState<string | undefined>(undefined);
  // Don't render the game until we know which map to load
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const storedUserId = localStorage.getItem("user_id") || "";
      const storedUsername =
        localStorage.getItem("username") ||
        "Player" + Math.floor(Math.random() * 1000);
      const storedToken = localStorage.getItem("token") || "";
      
      const storedCharacter = localStorage.getItem("selectedCharacter") || "bob";

      setUserId(storedUserId);
      setUsername(storedUsername);
      setToken(storedToken);
      setSelectedCharacter(storedCharacter);

      if (!storedToken) {
        console.warn("No token found. WebSocket may fail.");
      }

      trackServerVisit(serverId);

      // Fetch server details to read map_config.map_file
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${apiUrl}/servers/${serverId}`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "Content-Type": "application/json",
        },
      })
        .then((r) => r.json())
        .then((server) => {
          const mapFile: string | undefined = server?.map_config?.map_file;
          if (mapFile) setMapPath(mapFile);
        })
        .catch((err) =>
          console.warn("[ServerPage] Could not fetch server map config:", err),
        )
        .finally(() => setMapReady(true));
    }
  }, [serverId]);

  function trackServerVisit(serverIdToTrack: string) {
    try {
      const stored = localStorage.getItem("recentServers");
      let recent: Array<{ id: string; name: string; lastVisited: number }> =
        stored ? JSON.parse(stored) : [];

      recent = recent.filter((s) => s.id !== serverIdToTrack);

      recent.unshift({
        id: serverIdToTrack,
        name: `Server ${serverIdToTrack.slice(0, 8)}`,
        lastVisited: Date.now(),
      });

      recent = recent.slice(0, 10);

      localStorage.setItem("recentServers", JSON.stringify(recent));
    } catch (error) {
      console.error("Failed to track server visit:", error);
    }
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-lg border-4 border-border shadow-shadow animate-pulse mx-auto mb-4" />
          <p className="font-bold uppercase">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen flex">
      <ServerDock />
      {/* BaseSidebar is fixed w-16, so we create a placeholder spacer */}
      <div className="w-16 shrink-0">
        <BaseSidebar serverId={serverId} />
      </div>
      {/* Game area: takes all remaining horizontal space, full height */}
      <div className="flex-1 h-screen min-w-0">
        {mapReady ? (
          <GameWrapper
            userId={userId}
            username={username}
            serverId={serverId}
            token={token}
            characterId={selectedCharacter}
            mapPath={mapPath}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-background">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-lg border-4 border-border shadow-shadow animate-pulse mx-auto mb-4" />
              <p className="font-bold uppercase">Loading Space...</p>
            </div>
          </div>
        )}
      </div>
      <ProximityChat />
    </div>
  );
}
