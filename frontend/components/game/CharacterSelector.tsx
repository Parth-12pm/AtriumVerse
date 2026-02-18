"use client";

import { useState } from "react";
import {
  getAllCharacters,
  getCharacterPreview,
} from "@/types/advance_char_config";
import Image from "next/image";

interface CharacterSelectorProps {
  onSelect: (characterId: string) => void;
  currentCharacter?: string;
}

/**
 * Character selection component
 * Displays a grid of available characters with preview images
 */
export default function CharacterSelector({
  onSelect,
  currentCharacter = "bob",
}: CharacterSelectorProps) {
  const [selected, setSelected] = useState(currentCharacter);
  const characters = getAllCharacters();

  const handleSelect = (id: string) => {
    setSelected(id);
    onSelect(id);
  };

  return (
    <div className="p-5 bg-gray-900 rounded-lg">
      <h3 className="text-xl font-bold text-white mb-4">
        Choose Your Character
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {characters.map((char) => (
          <div
            key={char.id}
            className={`
              border-2 rounded-lg p-3 cursor-pointer transition-all duration-200
              ${
                selected === char.id
                  ? "border-blue-500 bg-blue-500/20 scale-105"
                  : "border-gray-700 bg-gray-800 hover:border-blue-400 hover:bg-blue-400/10"
              }
            `}
            onClick={() => handleSelect(char.id)}
          >
            <div className="aspect-square bg-gray-700 rounded mb-2 overflow-hidden">
              <Image
                src={getCharacterPreview(char)}
                alt={char.name}
                width={128}
                height={128}
                className="w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <p className="text-white text-sm text-center font-medium">
              {char.name}
            </p>
            <p className="text-gray-400 text-xs text-center mt-1">
              {char.sheets.length} animation
              {char.sheets.length !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
