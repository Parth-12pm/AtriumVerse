"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateRoomDialog } from "@/components/dashboard/create-room-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Calendar, CheckSquare, Clock, Video, MoreHorizontal, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Room {
  id: string;
  name: string;
  created_at: string;
  host_id?: string; // Optional if we add it later
}

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [username, setUsername] = useState("User");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "User");
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const data = await fetchAPI("/rooms/");
      if (Array.isArray(data)) {
         setRooms(data);
      }
    } catch (error) {
      toast.error("Failed to load rooms");
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <Badge variant="neutral" className="mb-2 bg-yellow-100 text-yellow-800 border-yellow-300">
             {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </Badge>
           <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
             Hi, {username}, Let&apos;s be productive
           </h1>
        </div>
        <CreateRoomDialog />
      </div>

      {/* 2. Stats Cards (Real Data) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#B4E4FF] dark:bg-blue-900 border-border">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
             <Video className="h-4 w-4 opacity-70" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-bold">{rooms.length}</div>
             <div className="flex items-center text-xs font-bold mt-2 opacity-80">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                <span>Live now</span>
             </div>
           </CardContent>
        </Card>
        
        {/* Placeholder Stats - can be connected to real data later */}
        <Card className="bg-white dark:bg-zinc-800 border-border">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium">Tasks Pending</CardTitle>
             <Clock className="h-4 w-4 opacity-70" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-bold">--</div>
             <p className="text-xs font-bold mt-2 opacity-50">Coming Soon</p>
           </CardContent>
        </Card>

        <Card className="bg-[#FFD4E3] dark:bg-pink-900 border-border">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium">Completed</CardTitle>
             <CheckSquare className="h-4 w-4 opacity-70" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-bold">--</div>
             <p className="text-xs font-bold mt-2 opacity-50">Coming Soon</p>
           </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3. Rooms List using Shadcn TABLE */}
        <Card className="lg:col-span-2 bg-[#FFDAB9] dark:bg-orange-950 border-border">
           <CardHeader>
             <CardTitle>Your Space (Rooms)</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="rounded-md border bg-background overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Room Name</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rooms.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No active rooms. Create one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rooms.map((room, index) => (
                                <TableRow key={room.id}>
                                    <TableCell>
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">
                                            {index + 1}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold">{room.name}</TableCell>
                                    <TableCell>{new Date(room.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => router.push(`/room/${room.id}`)}>
                                            Join
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
             </div>
           </CardContent>
        </Card>

        {/* 4. Daily Schedule - Keeping simple for now as we don't have backend for it */}
        <div className="space-y-6">
            <Card className="bg-[#D3F8D3] dark:bg-green-900 border-border">
                <CardHeader>
                    <CardTitle>Daily Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-3 bg-background border rounded-md">
                            <div className="bg-yellow-200 p-2 rounded-md">
                                <Clock className="h-4 w-4 text-yellow-800" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">9:00 AM - 10:00 AM</p>
                                <p className="font-bold">Team Sync</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 bg-background border rounded-md opacity-60">
                            <div className="bg-purple-200 p-2 rounded-md">
                                <Video className="h-4 w-4 text-purple-800" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">12:00 PM - 2:00 PM</p>
                                <p className="font-bold">Deep Work</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
