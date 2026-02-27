import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  Track,
} from "livekit-client";
import EventBus, { GameEvents } from "@/game/EventBus";
import { fetchLiveKitToken, getLiveKitUrl } from "@/lib/livekit";

import { MAX_HEAR_RADIUS } from "@/lib/game-constants";
export { MAX_HEAR_RADIUS };

// ── Types ─────────────────────────────────────────────────────────────────────
interface Position {
  x: number;
  y: number;
}

// ── Main class ────────────────────────────────────────────────────────────────
export class ProximityAudioManager {
  private room: Room | null = null;
  private myPos: Position = { x: 0, y: 0 };
  // Maps participant identity (user_id) → their latest tile position
  private otherPositions = new Map<string, Position>();
  private connected = false;
  private isConnecting = false;
  private micEnabled = false; // starts muted; user enables via dock

  async connect(serverId: string): Promise<void> {
    if (this.connected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const roomName = `audio_${serverId}`;
      const token = await fetchLiveKitToken(roomName);

      this.room = new Room({
        adaptiveStream: true,
        disconnectOnPageLeave: true,
      });

      // Fired when TRULY connected (including after regional failover)
      this.room.on(RoomEvent.Connected, async () => {
        await this.room?.localParticipant.setMicrophoneEnabled(this.micEnabled);
        this.connected = true;
        this.isConnecting = false;
        EventBus.emit(GameEvents.PROXIMITY_AUDIO_CONNECTED);
        console.log("🎙️ Proximity audio connected to:", roomName);
      });

      // When a remote audio track arrives: set initial volume + subscription
      this.room.on(RoomEvent.TrackSubscribed, (_track, pub, participant) => {
        if (pub.kind !== Track.Kind.Audio) return;
        this.applyProximity(participant);
      });

      // Chrome autoplay policy: resume AudioContext on first click
      const resumeAudio = () => {
        this.room?.startAudio();
        document.removeEventListener("click", resumeAudio);
      };
      document.addEventListener("click", resumeAudio);

      EventBus.on(GameEvents.PLAYER_POSITION, this.handleMyMove);
      EventBus.on(GameEvents.REMOTE_PLAYER_MOVED, this.handleRemoteMove);

      await this.room.connect(getLiveKitUrl(), token);
    } catch (err) {
      console.error("❌ Proximity audio failed to connect:", err);
      this.isConnecting = false;
    }
  }

  // ── Position handlers ────────────────────────────────────────────────────

  private handleMyMove = (data: Position) => {
    this.myPos = { x: data.x, y: data.y };
    this.updateAllParticipants();
  };

  private handleRemoteMove = (data: {
    userId: string;
    x: number;
    y: number;
  }) => {
    this.otherPositions.set(data.userId, { x: data.x, y: data.y });
    if (!this.room) return;
    for (const p of this.room.remoteParticipants.values()) {
      if (p.identity === data.userId) {
        this.applyProximity(p);
        break;
      }
    }
  };

  private updateAllParticipants() {
    if (!this.room) return;
    for (const p of this.room.remoteParticipants.values()) {
      this.applyProximity(p);
    }
  }

  // ── Core: distance → volume + subscription ───────────────────────────────

  private applyProximity(participant: RemoteParticipant) {
    const pos = this.otherPositions.get(participant.identity);

    // Linear falloff: full at 0 tiles, silent at MAX_HEAR_RADIUS
    const dist = pos
      ? Math.sqrt(
          Math.pow(this.myPos.x - pos.x, 2) + Math.pow(this.myPos.y - pos.y, 2),
        )
      : Infinity;

    const hearable = dist <= MAX_HEAR_RADIUS;
    const volume = hearable ? Math.max(0, 1 - dist / MAX_HEAR_RADIUS) : 0;

    // Set playback volume (0–1)
    participant.setVolume(volume);

    // Key optimisation from livekit-examples/spatial-audio:
    // Stop RECEIVING the track entirely when out of range — saves bandwidth.
    for (const pub of participant.trackPublications.values()) {
      if (
        pub.kind === Track.Kind.Audio &&
        pub instanceof RemoteTrackPublication
      ) {
        pub.setSubscribed(hearable);
      }
    }
  }

  // ── Public controls ──────────────────────────────────────────────────────

  async setMicEnabled(enabled: boolean): Promise<void> {
    this.micEnabled = enabled;
    if (!this.connected) return;
    try {
      await this.room?.localParticipant.setMicrophoneEnabled(enabled);
    } catch (err) {
      console.error("❌ Mic toggle failed:", err);
    }
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (!this.connected) return;
    try {
      await this.room?.localParticipant.setCameraEnabled(enabled);
    } catch (err) {
      console.error("❌ Camera toggle failed:", err);
    }
  }

  getMyPosition(): Position {
    return this.myPos;
  }

  isMicEnabled() {
    return this.micEnabled;
  }
  isConnected() {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    EventBus.off(GameEvents.PLAYER_POSITION, this.handleMyMove);
    EventBus.off(GameEvents.REMOTE_PLAYER_MOVED, this.handleRemoteMove);
    await this.room?.disconnect();
    this.room = null;
    this.connected = false;
    this.isConnecting = false;
    this.otherPositions.clear();
    EventBus.emit(GameEvents.PROXIMITY_AUDIO_DISCONNECTED);
    console.log("🔇 Proximity audio disconnected");
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────
let _instance: ProximityAudioManager | null = null;

export function getProximityAudio(): ProximityAudioManager {
  if (!_instance) _instance = new ProximityAudioManager();
  return _instance;
}
