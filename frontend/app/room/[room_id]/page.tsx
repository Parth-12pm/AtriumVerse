"use client";

import { useWebRTC } from "@/hooks/use-webrtc";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

export default function RoomPage() {
  const { room_id } = useParams(); // Note: room_id string from URL
  const [userId, setUserId] = useState("");
  
  // Create a random user ID for testing if not logged in, or use real one
  useEffect(() => {
      const stored = localStorage.getItem("username");
      setUserId(stored || `Guest-${Math.floor(Math.random() * 1000)}`);
  }, []);

  const { localStream, remoteStream } = useWebRTC(room_id as string, userId);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
      if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
      }
  }, [localStream]);

  useEffect(() => {
      if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
      }
  }, [remoteStream]);


  return (
    <div className="p-10 h-screen bg-zinc-100 flex flex-col items-center">
      <h1 className="text-3xl font-black mb-10">TEST LAB: {room_id}</h1>
      
      <div className="flex gap-10">
          {/* Local Video */}
          <Card className="p-4 border-2 border-black shadow-[4px_4px_0_0_#000]">
             <h2 className="font-bold mb-2">You ({userId})</h2>
             <video ref={localVideoRef} autoPlay muted playsInline className="w-[400px] h-[300px] bg-black rounded-md" />
          </Card>

          {/* Remote Video */}
          <Card className="p-4 border-2 border-black shadow-[4px_4px_0_0_#000]">
             <h2 className="font-bold mb-2">Remote User</h2>
             {remoteStream ? (
                 <video ref={remoteVideoRef} autoPlay playsInline className="w-[400px] h-[300px] bg-black rounded-md" />
             ) : (
                 <div className="w-[400px] h-[300px] bg-gray-300 flex items-center justify-center font-bold text-gray-500 rounded-md">
                     Waiting for peer...
                 </div>
             )}
          </Card>
      </div>
      
      <p className="mt-8 text-sm text-gray-500">
          Open this URL in a second tab (incognito) to test the connection!
      </p>
    </div>
  );
}
