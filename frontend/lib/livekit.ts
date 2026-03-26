const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

export function getLiveKitUrl(): string {
  return LIVEKIT_URL;
}

export async function fetchLiveKitToken(roomName: string): Promise<string> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(
    `${API_URL}/livekit/token?room_name=${encodeURIComponent(roomName)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error("Failed to fetch LiveKit token");
  const data = await res.json();
  return data.token;
}

export async function createInviteLink(roomName: string): Promise<string> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}/livekit/invite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ room_name: roomName }),
  });

  if (!res.ok) throw new Error("Failed to create invite");
  const data = await res.json();
  return data.invite_url;
}
