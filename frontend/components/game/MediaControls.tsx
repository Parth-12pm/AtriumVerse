'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff } from 'lucide-react';

interface MediaControlsProps {
  onAudioToggle?: (enabled: boolean) => void;
  onVideoToggle?: (enabled: boolean) => void;
  onScreenShareToggle?: (enabled: boolean) => void;
}

export function MediaControls({
  onAudioToggle,
  onVideoToggle,
  onScreenShareToggle,
}: MediaControlsProps) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
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
    <Card className="fixed bottom-4 left-1/2 -translate-x-1/2 p-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
      <div className="flex items-center gap-3">
        {/* Audio Toggle */}
        <Button
          variant={audioEnabled ? 'default' : 'neutral'}
          size="icon"
          onClick={handleAudioToggle}
          className={`border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
            !audioEnabled ? 'bg-red-500 hover:bg-red-600 text-white' : ''
          }`}
        >
          {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        {/* Video Toggle */}
        <Button
          variant={videoEnabled ? 'default' : 'neutral'}
          size="icon"
          onClick={handleVideoToggle}
          className={`border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
            !videoEnabled ? 'bg-red-500 hover:bg-red-600 text-white' : ''
          }`}
        >
          {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        {/* Screen Share Toggle */}
        <Button
          variant={'neutral'}
          size="icon"
          onClick={handleScreenShareToggle}
          disabled={true} // Disabled for now
          className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
        >
          {screenShareEnabled ? <MonitorUp className="h-5 w-5" /> : <MonitorOff className="h-5 w-5" />}
        </Button>
      </div>
    </Card>
  );
}
