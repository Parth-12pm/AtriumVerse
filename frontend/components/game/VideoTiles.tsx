"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface VideoTile {
  id: string;
  username: string;
  isSelf?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  // In future: videoStream?: MediaStream
}

interface VideoTilesProps {
  tiles: VideoTile[];
  maxVisible?: number;
}

export function VideoTiles({ tiles, maxVisible = 4 }: VideoTilesProps) {
  const visibleTiles = tiles.slice(0, maxVisible);
  const overflow = tiles.length - maxVisible;

  if (tiles.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex gap-3">
      {visibleTiles.map((tile) => (
        <div
          key={tile.id}
          className="relative w-40 h-28 bg-card border-4 border-border rounded-lg overflow-hidden shadow-shadow group"
        >
          {/* Video placeholder / Avatar */}
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            {tile.isVideoOff ? (
              <Avatar className="h-12 w-12 border-2 border-border">
                <AvatarFallback className="bg-primary text-primary-foreground font-black text-lg">
                  {tile.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              // Future: actual video element
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Avatar className="h-12 w-12 border-2 border-border">
                  <AvatarFallback className="bg-primary text-primary-foreground font-black">
                    {tile.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>

          {/* Self indicator */}
          {tile.isSelf && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded border-2 border-border">
              You
            </div>
          )}

          {/* Status indicators */}
          <div className="absolute bottom-2 left-2 flex gap-1">
            {tile.isMuted && (
              <div className="w-6 h-6 bg-destructive rounded-full flex items-center justify-center border-2 border-border">
                <MicOff className="h-3 w-3 text-white" />
              </div>
            )}
            {tile.isVideoOff && (
              <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center border-2 border-border">
                <VideoOff className="h-3 w-3" />
              </div>
            )}
          </div>

          {/* Username */}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-background/80 backdrop-blur text-xs font-bold rounded border border-border">
            {tile.username}
          </div>
        </div>
      ))}

      {overflow > 0 && (
        <div className="w-40 h-28 bg-card border-4 border-border rounded-lg flex items-center justify-center shadow-shadow">
          <span className="font-black text-lg">+{overflow}</span>
        </div>
      )}
    </div>
  );
}
