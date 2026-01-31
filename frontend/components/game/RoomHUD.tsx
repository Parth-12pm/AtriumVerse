'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LogOut, Users, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RoomHUDProps {
  roomName: string;
  roomType: string;
  playerCount: number;
  fps?: number;
}

export function RoomHUD({ roomName, roomType, playerCount, fps }: RoomHUDProps) {
  const router = useRouter();

  const handleExit = () => {
    router.push('/dashboard');
  };

  return (
    <Card className="fixed top-4 right-4 p-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
      <div className="flex flex-col gap-2 min-w-[200px]">
        {/* Room Info */}
        <div>
          <h2 className="text-lg font-bold">{roomName}</h2>
          <p className="text-sm text-muted-foreground capitalize">{roomType}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          <span>{playerCount} {playerCount === 1 ? 'player' : 'players'}</span>
        </div>

        {process.env.NODE_ENV === 'development' && fps !== undefined && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>{fps} FPS</span>
          </div>
        )}

        {/* Exit Button */}
        <Button
          variant="neutral"
          size="sm"
          onClick={handleExit}
          className="mt-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] bg-red-500 hover:bg-red-600 text-white"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Exit Room
        </Button>
      </div>
    </Card>
  );
}
