"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, Home } from "lucide-react";
import { motion } from "motion/react";
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
    <div className="fixed left-0 top-0 h-full w-16 bg-gray-900 border-r-4 border-black z-[1] flex flex-col items-center py-4 gap-3">
      {/* Home Button */}
      <motion.button
        onClick={navigateHome}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-none bg-background border-4 border-border shadow-shadow flex items-center justify-center"
        title="Home"
      >
        <Home size={22} />
      </motion.button>

      <div className="w-10 h-1 bg-white/20 rounded" />

      {/* Server Icons */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 items-center w-full px-2">
        {loading ? (
          <div className="w-12 h-12 rounded-xl bg-white/10 animate-pulse" />
        ) : (
          servers.map((server) => (
            <motion.button
              key={server.id}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => navigateToServer(server.id)}
              className={`w-12 h-12 border-4 flex items-center justify-center font-black text-xl transition-all ${
                server.id === currentServerId
                  ? "bg-primary border-border text-primary-foreground shadow-[4px_4px_0px_0px_white]"
                  : "bg-card border-border text-foreground hover:bg-primary/20"
              }`}
              title={server.name}
            >
              {server.name.charAt(0).toUpperCase()}
            </motion.button>
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
