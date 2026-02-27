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
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null,
  );
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const storedUserId = localStorage.getItem("user_id") || "";
      const storedUsername =
        localStorage.getItem("username") ||
        "Player" + Math.floor(Math.random() * 1000);
      const storedToken = localStorage.getItem("token") || "";
      const storedCharacter = localStorage.getItem("selectedCharacter");

      setUserId(storedUserId);
      setUsername(storedUsername);
      setToken(storedToken);

      if (storedCharacter) {
        setSelectedCharacter(storedCharacter);
      } else {
        // No character selected yet, will show selector
        setSelectedCharacter(null);
      }

      if (!storedToken) {
        console.warn("No token found. WebSocket may fail.");
      }

      // Track this server as recently visited
      trackServerVisit(serverId);
    }
  }, [serverId]);

  const trackServerVisit = (serverIdToTrack: string) => {
    try {
      const stored = localStorage.getItem("recentServers");
      let recent: Array<{ id: string; name: string; lastVisited: number }> =
        stored ? JSON.parse(stored) : [];

      // Remove if already exists
      recent = recent.filter((s) => s.id !== serverIdToTrack);

      // Add to front (we'll update the name later via API if needed)
      recent.unshift({
        id: serverIdToTrack,
        name: `Server ${serverIdToTrack.slice(0, 8)}`, // Placeholder name
        lastVisited: Date.now(),
      });

      // Keep only last 10
      recent = recent.slice(0, 10);

      localStorage.setItem("recentServers", JSON.stringify(recent));
    } catch (error) {
      console.error("Failed to track server visit:", error);
    }
  };

  const handleCharacterSelect = (characterId: string) => {
    setSelectedCharacter(characterId);
    localStorage.setItem("selectedCharacter", characterId);
    setShowCharacterSelect(false);
  };

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

  // Show character selection if no character selected or user wants to change
  if (!selectedCharacter || showCharacterSelect) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-4xl w-full mx-auto p-6">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to the Space!
            </h1>
            <p className="text-gray-400">
              Choose your character to get started
            </p>
          </div>
          <CharacterSelector
            onSelect={handleCharacterSelect}
            currentCharacter={selectedCharacter || "bob"}
          />
          {selectedCharacter && (
            <div className="mt-4 text-center">
              <Button
                variant="neutral"
                onClick={() => setShowCharacterSelect(false)}
              >
                Cancel
              </Button>
            </div>
          )}
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
        <GameWrapper
          userId={userId}
          username={username}
          serverId={serverId}
          token={token}
          characterId={selectedCharacter}
        />
      </div>
      <ProximityChat />
    </div>
  );
}
