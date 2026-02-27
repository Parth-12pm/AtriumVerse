"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Map,
  LogOut,
} from "lucide-react";

interface MediaControlsProps {
  onAudioToggle?: (enabled: boolean) => void;
  onVideoToggle?: (enabled: boolean) => void;
  onScreenShareToggle?: (enabled: boolean) => void;
  onMinimapToggle?: () => void;
  onExit?: () => void;
  showMinimap?: boolean;
}

export function MediaControls({
  onAudioToggle,
  onVideoToggle,
  onScreenShareToggle,
  onMinimapToggle,
  onExit,
  showMinimap = false,
}: MediaControlsProps) {
  const [audioEnabled, setAudioEnabled] = useState(false); // muted by default
  const [videoEnabled, setVideoEnabled] = useState(false); // camera off by default
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);

  const handleAudioToggle = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    onAudioToggle?.(newState);
  };

  const handleVideoToggle = () => {
    const newState = !videoEnabled;
    setVideoEnabled(newState);
    onVideoToggle?.(newState);
  };

  const handleScreenShareToggle = () => {
    const newState = !screenShareEnabled;
    setScreenShareEnabled(newState);
    onScreenShareToggle?.(newState);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-card border-4 border-border rounded-lg shadow-shadow">
      {/* Exit Button */}
      {onExit && (
        <>
          <Button
            variant="default"
            size="icon"
            onClick={onExit}
            className="border-2 border-border bg-red-500 hover:bg-red-600 text-white"
          >
            <LogOut className="h-5 w-5" />
          </Button>
          <div className="w-px h-8 bg-border" />
        </>
      )}

      {/* Audio Toggle */}
      <Button
        variant={audioEnabled ? "default" : "neutral"}
        size="icon"
        onClick={handleAudioToggle}
        className={`border-2 border-border ${
          !audioEnabled
            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            : ""
        }`}
      >
        {audioEnabled ? (
          <Mic className="h-5 w-5" />
        ) : (
          <MicOff className="h-5 w-5" />
        )}
      </Button>

      {/* Video Toggle */}
      <Button
        variant={videoEnabled ? "default" : "neutral"}
        size="icon"
        onClick={handleVideoToggle}
        className={`border-2 border-border ${
          !videoEnabled
            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            : ""
        }`}
      >
        {videoEnabled ? (
          <Video className="h-5 w-5" />
        ) : (
          <VideoOff className="h-5 w-5" />
        )}
      </Button>

      {/* Screen Share Toggle */}
      <Button
        variant="neutral"
        size="icon"
        onClick={handleScreenShareToggle}
        disabled={true}
        className="border-2 border-border disabled:opacity-50"
      >
        {screenShareEnabled ? (
          <MonitorUp className="h-5 w-5" />
        ) : (
          <MonitorOff className="h-5 w-5" />
        )}
      </Button>

      <div className="w-px h-8 bg-border" />

      {/* Minimap Toggle */}
      {onMinimapToggle && (
        <Button
          variant={showMinimap ? "default" : "neutral"}
          size="icon"
          onClick={onMinimapToggle}
          className="border-2 border-border"
        >
          <Map className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
