import { useEffect, useRef, useState } from "react";
import EventBus, { GameEvents, PlayerPositionEvent } from "../game/EventBus";
import { rtcManager } from "../lib/webrtc/RTCConnectionManager";

const CONNECT_DISTANCE = 5;
const DISCONNECT_DISTANCE = 7;

export function useProximityPeers(myUserId: string | null) {
  const [myPosition, setMyPosition] = useState({ x: 0, y: 0 });
  const remotePositions = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  // Logic: Check distance to ONE peer (called when they move or I move)
  const checkDistance = (
    userId: string,
    peerX: number,
    peerY: number,
    myX: number,
    myY: number,
  ) => {
    if (!myUserId || userId === myUserId) return;

    const dx = Math.abs(peerX - myX);
    const dy = Math.abs(peerY - myY);
    const distance = Math.sqrt(dx * dx + dy * dy); // Euclidean

    // Hysteresis
    // If < 5, Connect
    // If > 7, Disconnect
    // Between 5-7, keep current state (handled implicitly by RTCManager not disconnecting until explicitly told)

    if (distance < CONNECT_DISTANCE) {
      // Attempt connect (initiator=true if myId > userId to avoid dual-init)
      // Simple tie-breaker: sort IDs
      const isInitiator = myUserId > userId;
      rtcManager.connectToPeer(userId, isInitiator);
    } else if (distance > DISCONNECT_DISTANCE) {
      rtcManager.disconnectPeer(userId);
    }

    // Always update audio position if connected
    rtcManager.updateSpatialPosition(
      { x: myX, y: myY },
      { x: peerX, y: peerY },
      userId,
    );
  };

  // Logic: Check distance to ALL peers (called when I move)
  const checkProximity = (myX: number, myY: number) => {
    remotePositions.current.forEach((pos, userId) => {
      checkDistance(userId, pos.x, pos.y, myX, myY);
    });
  };

  // Initialize Local Media on mount
  useEffect(() => {
    if (!myUserId) return;

    // Auto-start microphone/camera when entering game
    rtcManager.startLocalStream().then((stream) => {
      if (stream) {
        console.log("🎤 Local stream started");
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, [myUserId]);

  // Listen for MY position updates
  useEffect(() => {
    const handleMyPosition = (pos: PlayerPositionEvent) => {
      setMyPosition({ x: pos.x, y: pos.y });
      checkProximity(pos.x, pos.y);
    };

    EventBus.on(GameEvents.PLAYER_POSITION, handleMyPosition);
    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handleMyPosition);
    };
  }, [myUserId]);

  // Listen for REMOTE position updates
  useEffect(() => {
    const handleRemoteMove = (data: {
      userId: string;
      x: number;
      y: number;
    }) => {
      remotePositions.current.set(data.userId, { x: data.x, y: data.y });

      // Update spatial audio position
      rtcManager.updateSpatialPosition(
        myPosition,
        { x: data.x, y: data.y },
        data.userId,
      );

      // Check distance just for this user
      checkDistance(data.userId, data.x, data.y, myPosition.x, myPosition.y);
    };

    // Also handle full list updates to populate initial positions
    const handleListUpdate = (users: any[]) => {
      users.forEach((u) => {
        if (u.user_id !== myUserId) {
          remotePositions.current.set(u.user_id, { x: u.x, y: u.y });
          // Check initial distance
          checkDistance(u.user_id, u.x, u.y, myPosition.x, myPosition.y);
        }
      });
    };

    EventBus.on(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);
    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handleListUpdate);

    return () => {
      EventBus.off(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);
      EventBus.off(GameEvents.PLAYER_LIST_UPDATE, handleListUpdate);
    };
  }, [myPosition, myUserId]);
}
