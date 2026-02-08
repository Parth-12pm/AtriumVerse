"use client";

import  { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Home, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serversAPI } from "@/lib/services/api.service";
import type { Server } from "@/types/api.types";

export default function ServerDock() {
  const router = useRouter();
  const params = useParams();
  const currentServerId = params.id as string;
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const response = await serversAPI.list();
      setServers(response.data);
    } catch (error) {
      console.error("Failed to load servers:", error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToServer = (serverId: string) => {
    router.push(`/server/${serverId}`);
  };

  const navigateHome = () => {
    router.push("/servers");
  };

  return (
    <div className="fixed left-0 top-0 h-full w-16 bg-gray-900 border-r-4 border-black z-50 flex flex-col items-center py-4 gap-3">
      {/* Home Button */}
      <Button
        onClick={navigateHome}
        variant="neutral"
        size="icon"
        className="w-12 h-12 rounded-xl bg-white hover:bg-gray-100 border-3 border-black"
        title="Home"
      >
        <Home className="w-6 h-6" />
      </Button>

      <div className="w-10 h-1 bg-white/20 rounded" />

      {/* Server Icons */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 items-center w-full px-2">
        {loading ? (
          <div className="w-12 h-12 rounded-xl bg-white/10 animate-pulse" />
        ) : (
          servers.map((server) => (
            <button
              key={server.id}
              onClick={() => navigateToServer(server.id)}
              className={`w-12 h-12 rounded-xl border-3 flex items-center justify-center font-black text-xl transition-all hover:rounded-lg ${
                server.id === currentServerId
                  ? "bg-blue-500 border-white text-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)]"
                  : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              }`}
              title={server.name}
            >
              {server.name.charAt(0).toUpperCase()}
            </button>
          ))
        )}
      </div>

      {/* Add Server Button */}
      <Button
        onClick={() => router.push("/servers")}
        variant="neutral"
        size="icon"
        className="w-12 h-12 rounded-xl bg-green-500 hover:bg-green-600 border-3 border-black text-white"
        title="Add Server"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}
