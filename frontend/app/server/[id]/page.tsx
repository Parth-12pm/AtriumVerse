"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import BaseSidebar from "@/components/sidebar/BaseSidebar";
import ProximityChat from "@/components/game/ProximityChat";
import ServerDock from "@/components/navigation/ServerDock";

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

  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("Player");
  const [token, setToken] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const storedUserId = localStorage.getItem("user_id") || "";
      const storedUsername =
        localStorage.getItem("username") ||
        "Player" + Math.floor(Math.random() * 1000);
      const storedToken = localStorage.getItem("token") || "";

      setUserId(storedUserId);
      setUsername(storedUsername);
      setToken(storedToken);

      if (!storedToken) {
        console.warn("No token found. WebSocket may fail.");
      }
    }
  }, []);

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
    <div className="relative w-full h-screen">
      <ServerDock />
      <div className="ml-16">
        <BaseSidebar serverId={serverId} />
        <div className="ml-16 w-[calc(100%-8rem)] h-full">
          <GameWrapper
            userId={userId}
            username={username}
            serverId={serverId}
            token={token}
          />
        </div>
      </div>
      <ProximityChat />
    </div>
  );
}
