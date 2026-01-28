import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, 
  ],
};

export function useWebRTC(roomId: string, userId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  
  // Ref for socket to avoid closure staleness in callbacks
  const socketRef = useRef<WebSocket | null>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);

  // 1. Get Local Media
  useEffect(() => {
    async function startMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        } catch (err) {
            console.error(err);
            toast.error("Could not access camera/mic");
        }
    }
    startMedia();

    return () => {
        localStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // 2. Connect WebSocket
  useEffect(() => {
     if(!userId || !roomId || !localStream) return;

     const ws = new WebSocket(`ws://localhost:8000/ws/connect?room_id=${roomId}&user_id=${userId}`);
     socketRef.current = ws;

     ws.onopen = () => {
         console.log("WS Connected");
         toast.success("Connected to Signaling Server");
     };

     ws.onmessage = async (event) => {
         const data = JSON.parse(event.data);
         
         if (!peerConnection.current) createPeerConnection();
         const pc = peerConnection.current!;

         try {
            switch (data.type) {
                case "user_joined":
                    console.log("User joined, creating offer...");
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    ws.send(JSON.stringify({ type: "offer", sdp: offer }));
                    break;
                
                case "offer":
                    console.log("Received Offer");
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    ws.send(JSON.stringify({ type: "answer", sdp: answer }));
                    processQueuedCandidates(pc);
                    break;
                
                case "answer":
                    console.log("Received Answer");
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    processQueuedCandidates(pc);
                    break;
                
                case "ice-candidate":
                    console.log("Received ICE Candidate");
                    const candidate = new RTCIceCandidate(data.candidate);
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(candidate);
                    } else {
                        pendingCandidates.current.push(candidate);
                    }
                    break;
            }
         } catch (err) {
            console.error("Signaling Error:", err);
         }
     };

     return () => {
         ws.close();
         socketRef.current = null;
         if (peerConnection.current) {
             peerConnection.current.close();
             peerConnection.current = null;
         }
     };
  }, [userId, roomId, localStream]);


  const processQueuedCandidates = async (pc: RTCPeerConnection) => {
      while (pendingCandidates.current.length > 0) {
          const candidate = pendingCandidates.current.shift();
          if (candidate) {
              await pc.addIceCandidate(candidate);
          }
      }
  };

  const createPeerConnection = () => {
      if (peerConnection.current) return peerConnection.current;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnection.current = pc;

      if (localStream) {
          localStream.getTracks().forEach(track => {
              pc.addTrack(track, localStream);
          });
      }

      pc.ontrack = (event) => {
          console.log("Remote Stream Received!");
          setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                  type: "ice-candidate",
                  candidate: event.candidate,
                  target: "peer" 
              }));
          }
      };
      
      return pc;
  };

  return { localStream, remoteStream };
}
