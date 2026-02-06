"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Map,
  MessageSquare,
  Video,
  Settings,
  Gift,
  Calendar,
  Bell,
  Users,
  LogOut,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatExpandedView from "@/components/sidebar/chat/ChatExpandedView";
import PeopleExpandedView from "@/components/sidebar/people/PeopleExpandedView";
import EventBus, { GameEvents } from "@/game/EventBus";

interface BaseSidebarProps {
  serverId: string;
}

type SidebarView =
  | "collapsed"
  | "map"
  | "chat"
  | "media"
  | "settings"
  | "people";

export default function BaseSidebar({ serverId }: BaseSidebarProps) {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<SidebarView>("collapsed");
  const [currentZone, setCurrentZone] = useState("Hall");
  const [isServerOwner, setIsServerOwner] = useState(false);

  // Listen to zone changes via EventBus
  useEffect(() => {
    const handleZoneEnter = (data: { roomId: string }) => {
      setCurrentZone(
        data.roomId.charAt(0).toUpperCase() + data.roomId.slice(1),
      );
    };

    EventBus.on(GameEvents.ROOM_ENTER, handleZoneEnter);

    return () => {
      EventBus.off(GameEvents.ROOM_ENTER, handleZoneEnter);
    };
  }, []);

  const toggleView = (view: SidebarView) => {
    if (currentView === view) {
      setCurrentView("collapsed");
    } else {
      setCurrentView(view);
    }
  };

  return (
    <>
      {/* Icon Sidebar - Always Visible */}
      <div className="fixed left-0 top-0 h-full w-19 bg-white border-r-4 border-black z-50 flex flex-col items-center py-4 gap-4">
        {/* Logo */}
        <div className="w-12 h-12 bg-purple-500 border-3 border-black rounded-lg flex items-center justify-center mb-4">
          <span className="text-white font-black text-xl">AV</span>
        </div>

        {/* Zone Indicator */}
        <div className="text-center mb-2">
          <p className="text-xs font-black text-gray-600">{currentZone}</p>
        </div>

        {/* Divider */}
        <div className="w-8 h-1 bg-black"></div>

        {/* Map Button */}
        <Button
          onClick={() => toggleView("map")}
          variant="neutral"
          size="icon"
          className={`w-12 h-12 rounded-lg ${
            currentView === "map"
              ? "bg-purple-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title="Map"
        >
          <Map className="w-6 h-6" />
        </Button>

        {/* Chat Button */}
        <Button
          onClick={() => toggleView("chat")}
          variant="neutral"
          size="icon"
          className={`w-12 h-12 rounded-lg ${
            currentView === "chat"
              ? "bg-blue-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title="Chat"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>

        {/* People Button */}
        <Button
          onClick={() => toggleView("people")}
          variant="neutral"
          size="icon"
          className={`w-12 h-12 rounded-lg ${
            currentView === "people"
              ? "bg-purple-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title="People"
        >
          <Users className="w-6 h-6" />
        </Button>

        {/* Media Room Button (Future LiveKit) */}
        <Button
          onClick={() => toggleView("media")}
          variant="neutral"
          size="icon"
          className={`w-12 h-12 rounded-lg ${
            currentView === "media"
              ? "bg-green-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title="Media Room (Coming Soon)"
        >
          <Video className="w-6 h-6" />
        </Button>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Bottom Buttons */}

        <Button
          onClick={() => toggleView("settings")}
          variant="neutral"
          size="icon"
          className={`w-12 h-12 rounded-lg ${
            currentView === "settings"
              ? "bg-gray-800 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title="Settings"
        >
          <Settings className="w-6 h-6" />
        </Button>
      </div>

      {/* Chat View */}
      {currentView === "chat" && (
        <ChatExpandedView
          serverId={serverId}
          onClose={() => setCurrentView("collapsed")}
        />
      )}

      {/* People View */}
      {currentView === "people" && (
        <PeopleExpandedView
          serverId={serverId}
          onClose={() => setCurrentView("collapsed")}
        />
      )}

      {currentView === "map" && (
        <div className="fixed  left-19 top-0 h-full w-[400px] bg-white border-r-4 border-black z-40 flex flex-col">
          {/* Map View Header */}
          <div className="p-4 border-b-4 border-black bg-purple-500 flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Map Overview</h2>
            <Button
              onClick={() => setCurrentView("collapsed")}
              variant="default"
              className="bg-white text-black hover:bg-gray-100"
            >
              Collapse
            </Button>
          </div>

          {/* Map Content */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="bg-yellow-100 border-3 border-black rounded-lg p-4">
              <p className="font-bold">🗺️ Mini-map coming soon!</p>
              <p className="text-sm mt-2">
                This will show an overview of the entire server map with your
                current position.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentView === "media" && (
        <div className="fixed     left-26 top-0 h-full w-[400px] bg-white border-r-4 border-black z-40 flex flex-col">
          {/* Media View Header */}
          <div className="p-4 border-b-4 border-black bg-green-500 flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Media Room</h2>
            <Button
              onClick={() => setCurrentView("collapsed")}
              variant="default"
              className="bg-white text-black hover:bg-gray-100"
            >
              Collapse
            </Button>
          </div>

          {/* Media Content */}
          <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
            <div className="bg-green-100 border-3 border-black rounded-lg p-6 text-center max-w-sm">
              <Video className="w-16 h-16 mx-auto mb-4" />
              <p className="font-bold text-lg mb-2">LiveKit Integration</p>
              <p className="text-sm text-gray-700">
                Voice and video chat will be available here once LiveKit is
                integrated!
              </p>
            </div>
          </div>
        </div>
      )}

      {currentView === "settings" && (
        <div className="fixed     left-26 top-0 h-full w-[400px] bg-white border-r-4 border-black z-40 flex flex-col">
          {/* Settings View Header */}
          <div className="p-4 border-b-4 border-black bg-gray-800 flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Settings</h2>
            <Button
              onClick={() => setCurrentView("collapsed")}
              variant="default"
              className="bg-white text-black hover:bg-gray-100"
            >
              Close
            </Button>
          </div>

          {/* Settings Content */}
          <div className="flex-1 p-4 overflow-auto flex flex-col gap-4">
            {/* Server Info */}
            <div className="bg-gray-100 border-3 border-black rounded-lg p-4">
              <p className="font-bold mb-2">📋 Server Info</p>
              <p className="text-sm text-gray-700 mb-2">
                Server ID:{" "}
                <code className="bg-white px-2 py-1 rounded text-xs">
                  {serverId.slice(0, 8)}...
                </code>
              </p>
            </div>

            {/* Leave Server (All Users) */}
            <div className="bg-orange-50 border-3 border-orange-500 rounded-lg p-4">
              <h3 className="font-black text-orange-700 mb-2 flex items-center gap-2">
                <LogOut className="w-5 h-5" />
                Leave Server
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                You'll lose access to all channels. You can rejoin later if
                invited.
              </p>
              <Button
                onClick={() => {
                  if (confirm("Are you sure you want to leave this server?")) {
                    // TODO: Call API to leave server
                    router.push("/servers");
                  }
                }}
                variant="neutral"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white border-3 border-black"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave Server
              </Button>
            </div>

            {/* Delete Server (Owner Only) */}
            {isServerOwner && (
              <div className="bg-red-50 border-4 border-red-600 rounded-lg p-4">
                <h3 className="font-black text-red-700 mb-2 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Danger Zone - Delete Server
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  ⚠️ <strong>This action cannot be undone!</strong> All
                  channels, messages, and members will be permanently deleted.
                </p>
                <Button
                  onClick={() => {
                    if (
                      confirm(
                        "⚠️ DELETE SERVER? This CANNOT be undone! Type 'DELETE' to confirm.",
                      )
                    ) {
                      // TODO: Call serversAPI.delete(serverId)
                      router.push("/servers");
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold border-3 border-black"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Server Permanently
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
