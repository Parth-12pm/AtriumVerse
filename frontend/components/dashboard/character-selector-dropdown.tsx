"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getAllCharacters,
  getCharacterById,
  type CharacterAnimationSet,
} from "@/types/advance_char_config";
import { ChevronDown, Check } from "lucide-react";

/**
 * Returns style for a raw 16x32px sprite div showing the idle-down frame (frame 3).
 * Must be scaled up via CSS transform by the consumer.
 */
function getIdleDownRawStyle(char: CharacterAnimationSet): React.CSSProperties {
  const idleAnim = char.animations.find((a) => a.animationKey === "idle-down");
  const sheet = char.sheets[0]; // idle sheet is always first
  if (!idleAnim || !sheet) return {};

  const frameIndex = idleAnim.frames[0] ?? 0;
  // Use NATURAL dimensions
  const fw = sheet.frameWidth; // 16px
  const fh = sheet.frameHeight; // 32px
  const offsetX = -(frameIndex * fw); // e.g. -48px

  return {
    backgroundImage: `url('${sheet.spritePath}')`,
    backgroundPosition: `${offsetX}px 0px`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "auto", // Keep natural size so offsets work
    imageRendering: "pixelated" as const,
    width: `${fw}px`,
    height: `${fh}px`,
  };
}

export function CharacterSelectorDropdown({
  onSelect,
}: {
  onSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("bob");
  const allCharacters = getAllCharacters();

  useEffect(() => {
    const saved = localStorage.getItem("selectedCharacter") || "bob";
    setSelectedId(saved);
  }, []);

  const selectedChar = getCharacterById(selectedId);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    localStorage.setItem("selectedCharacter", id);
    setOpen(false);
    onSelect?.(id);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="neutral"
          className="flex items-center gap-3 h-11 px-2 pl-2 pr-4 border-2 border-border font-bold rounded-full bg-card hover:bg-muted/50 transition-all"
        >
          {/* Circular preview container */}
          <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-border overflow-hidden relative flex-shrink-0">
            {selectedChar && (
              <div
                style={{
                  ...getIdleDownRawStyle(selectedChar),
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  // Scale 16x32 -> 32x64 (2x)
                  // Translate -50%, -25% to focus on head/upper torso
                  transform: "translate(-50%, -80%) scale(1.5)",
                  transformOrigin: "center top",
                }}
              />
            )}
          </div>

          <div className="flex flex-col items-start gap-0.5 max-w-[90px]">
            <span className="text-[10px] uppercase font-black text-muted-foreground leading-none tracking-wider">
              Character
            </span>
            <span className="text-sm font-bold leading-none truncate w-full text-left">
              {selectedChar?.name ?? "Select"}
            </span>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground ml-1 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-80 p-5 border-2 border-border bg-card"
        sideOffset={8}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Select Avatar
          </p>
          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {allCharacters.length} Available
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {allCharacters.map((char) => {
            const isSelected = char.id === selectedId;
            return (
              <button
                key={char.id}
                onClick={() => handleSelect(char.id)}
                className={`group relative flex flex-col items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer outline-none
                  ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-[0_0_0_2px] shadow-primary/20"
                      : "border-border bg-muted/30 hover:bg-muted hover:border-primary/50"
                  }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-10 shadow-sm">
                    <Check className="w-3 h-3 text-primary-foreground stroke-[3]" />
                  </div>
                )}

                {/* Card Preview: 16x32 sprite scaled 3x (48x96) in a 64px tall box */}
                <div className="w-14 h-16 rounded-lg bg-background border-2 border-border/50 overflow-hidden relative shadow-inner">
                  <div
                    style={{
                      ...getIdleDownRawStyle(char),
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -100%) scale(1.8)",
                      transformOrigin: "center top",
                    }}
                  />
                </div>

                <span
                  className={`text-xs font-bold w-full text-center truncate ${isSelected ? "text-primary" : "text-foreground"}`}
                >
                  {char.name}
                </span>
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
