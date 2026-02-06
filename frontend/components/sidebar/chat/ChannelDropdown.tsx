"use client";

import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2 } from "lucide-react";

interface ChannelDropdownProps {
  channelId: string;
  channelName: string;
  onEdit: (channelId: string) => void;
  onDelete: (channelId: string) => void;
}

export default function ChannelDropdown({
  channelId,
  channelName,
  onEdit,
  onDelete,
}: ChannelDropdownProps) {
  const handleDelete = () => {
    if (
      confirm(
        `Are you sure you want to delete #${channelName}? This action cannot be undone.`,
      )
    ) {
      onDelete(channelId);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="neutral"
          size="icon"
          className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-2 border-black">
        <DropdownMenuItem onClick={() => onEdit(channelId)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Channel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Channel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
