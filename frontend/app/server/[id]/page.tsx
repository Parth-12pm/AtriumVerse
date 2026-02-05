"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

import { useProximityPeers } from "@/hooks/use-proximity-peers";
import { FloatingVideoTiles } from "@/components/game/FloatingVideoTiles";

// SSR disabled - grid-engine requires browser
const GameWrapper = dynamic(() => import("@/components/game/GameWrapperNew"), {
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
  const router = useRouter();
  const { id: serverId } = use(params);

  // User data
  const [userId] = useState(
    // Ensure consistent ID for the same session if possible, or random
    // Ideally this should come from Auth Context
    typeof window !== "undefined" && localStorage.getItem("userId")
      ? localStorage.getItem("userId")!
      : "test-user-" + Math.random().toString(36).substr(2, 9),
  );

  const [username, setUsername] = useState("Player");
  const [token, setToken] = useState("");
  const [mounted, setMounted] = useState(false);

  // Initialize WebRTC Proximity Logic
  useProximityPeers(mounted ? userId : null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const storedUsername =
        localStorage.getItem("username") ||
        "Player" + Math.floor(Math.random() * 1000);
      const storedToken = localStorage.getItem("token") || "";

      setUsername(storedUsername);
      setToken(storedToken);

      if (!storedToken) {
        console.warn(
          "No token found in localStorage. WebSocket connection may fail.",
        );
      }
    }
  }, []);

  return (
    <div className="h-full w-full relative">
      <FloatingVideoTiles />
      <GameWrapper
        userId={userId}
        username={mounted ? username : "Player"}
        serverId={serverId}
        token={mounted ? token : ""}
      />
    </div>
  );
}
