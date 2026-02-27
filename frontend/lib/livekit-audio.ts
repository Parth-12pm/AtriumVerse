import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  type RemoteAudioTrack,
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
  /** Maps participant identity → their latest tile position */
  private otherPositions = new Map<string, Position>();
  /**
   * Maps participant identity → their attached HTMLAudioElement.
   *
   * livekit-client v2 does NOT auto-attach audio tracks to DOM elements.
   * Without a DOM <audio> element, participant.setVolume() is a no-op because
   * it iterates attachedElements (which is empty) and never sets el.volume.
   * We manage these elements explicitly.
   */
  private audioElements = new Map<string, HTMLAudioElement>();
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

      this.room.on(RoomEvent.Connected, async () => {
        await this.room?.localParticipant.setMicrophoneEnabled(this.micEnabled);
        this.connected = true;
        this.isConnecting = false;
        EventBus.emit(GameEvents.PROXIMITY_AUDIO_CONNECTED);
        console.log("🎙️ Proximity audio connected to:", roomName);
      });

      // v2: attach audio element manually on subscription
      this.room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (pub.kind !== Track.Kind.Audio) return;
        this.attachAudio(participant, track as RemoteAudioTrack);
        this.applyProximity(participant);
      });

      // Clean up audio element when track goes away
      this.room.on(RoomEvent.TrackUnsubscribed, (_track, pub, participant) => {
        if (pub.kind !== Track.Kind.Audio) return;
        const el = this.audioElements.get(participant.identity);
        if (el) {
          el.pause();
          el.remove();
        }
        this.audioElements.delete(participant.identity);
      });

      // Resume AudioContext on first user gesture (Chrome autoplay policy)
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

  // ── Attach audio track to a DOM <audio> element ──────────────────────────
  private attachAudio(participant: RemoteParticipant, track: RemoteAudioTrack) {
    // Remove stale element if re-subscribing
    const old = this.audioElements.get(participant.identity);
    if (old) {
      old.pause();
      old.remove();
    }

    const el = track.attach() as HTMLAudioElement;
    el.volume = 0; // silent until proximity is calculated
    el.autoplay = true;
    el.style.display = "none";
    document.body.appendChild(el);
    this.audioElements.set(participant.identity, el);

    // Attempt play; will succeed after startAudio() is called on first click
    el.play().catch(() => {});
    console.log(
      `[LiveKit] 🔊 Attached audio for ${participant.identity.slice(0, 8)}`,
    );
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

  // ── Core: distance → volume ──────────────────────────────────────────────
  // Volume-only approach: no setSubscribed() calls.
  // The <audio> element stays attached; we just set element.volume = 0 for silence.
  // This eliminates the race condition where TrackSubscribed fires before
  // any REMOTE_PLAYER_MOVED, causing the track to be permanently unsubscribed.
  private applyProximity(participant: RemoteParticipant) {
    const pos = this.otherPositions.get(participant.identity);
    const el = this.audioElements.get(participant.identity);

    if (!pos) {
      // Position not yet known — keep silent, don't disconnect
      if (el) el.volume = 0;
      return;
    }

    const dist = Math.sqrt(
      Math.pow(this.myPos.x - pos.x, 2) + Math.pow(this.myPos.y - pos.y, 2),
    );
    const volume =
      dist <= MAX_HEAR_RADIUS ? Math.max(0, 1 - dist / MAX_HEAR_RADIUS) : 0;

    console.log(
      `[Proximity] ${participant.identity.slice(0, 8)} dist=${dist.toFixed(1)} vol=${volume.toFixed(2)}`,
    );

    if (el) {
      el.volume = volume; // direct DOM element volume — reliable in livekit-client v2
    } else {
      // Fallback if audio element isn't attached yet
      participant.setVolume(volume);
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
  isMicEnabled(): boolean {
    return this.micEnabled;
  }
  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    EventBus.off(GameEvents.PLAYER_POSITION, this.handleMyMove);
    EventBus.off(GameEvents.REMOTE_PLAYER_MOVED, this.handleRemoteMove);
    // Remove all audio elements from DOM
    this.audioElements.forEach((el) => {
      el.pause();
      el.remove();
    });
    this.audioElements.clear();
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
