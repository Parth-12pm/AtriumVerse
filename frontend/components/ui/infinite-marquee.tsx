"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface InfiniteMarqueeProps {
  items: string[];
  speed?: number;
  direction?: "left" | "right";
  className?: string;
  itemClassName?: string;
  separator?: string;
}

export function InfiniteMarquee({
  items,
  speed = 35,
  direction = "left",
  className,
  itemClassName,
  separator = "✦",
}: InfiniteMarqueeProps) {
  // Triple-duplicate to ensure seamless loop even on wide screens
  const content = [...items, ...items, ...items];

  return (
    <div className={cn("overflow-hidden select-none", className)}>
      <motion.div
        className="flex whitespace-nowrap"
        animate={{
          x: direction === "left" ? [0, "-33.333%"] : ["-33.333%", 0],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: speed,
            ease: "linear",
          },
        }}
      >
        {content.map((item, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-6 px-6 font-black uppercase tracking-widest text-sm",
              itemClassName,
            )}
          >
            <span>{item}</span>
            <span className="text-primary opacity-80">{separator}</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}
