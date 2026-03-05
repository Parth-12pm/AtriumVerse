"use client";

import { useState } from "react";
import Image from "next/image";
import { ALL_MAPS, MapConfig } from "@/lib/map-config";
import { MapPin } from "lucide-react";

interface MapSelectorProps {
  selectedMapPath: string;
  onSelect: (mapPath: string) => void;
}

/**
 * Inline map picker — mirrors CharacterSelector's grid pattern.
 * Shows thumbnail, name, and description cards for each registered map.
 */
export function MapSelector({ selectedMapPath, onSelect }: MapSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        <MapPin className="w-4 h-4" />
        Choose Map
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_MAPS.map((map: MapConfig) => {
          const isSelected = selectedMapPath === map.mapPath;
          return (
            <button
              key={map.id}
              type="button"
              onClick={() => onSelect(map.mapPath)}
              className={`
                relative flex flex-col rounded-xl overflow-hidden border-2 transition-all duration-200 text-left
                ${
                  isSelected
                    ? "border-indigo-500 ring-2 ring-indigo-500/40 scale-[1.02]"
                    : "border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:scale-[1.01]"
                }
              `}
            >
              {/* Thumbnail */}
              <div className="relative w-full h-28 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <Image
                  src={map.thumbnail}
                  alt={map.name}
                  fill
                  className="object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-white flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              {/* Meta */}
              <div className="px-3 py-2 bg-white dark:bg-gray-900">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {map.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                  {map.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
