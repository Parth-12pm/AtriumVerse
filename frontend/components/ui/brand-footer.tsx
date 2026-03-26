"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

interface BrandFooterProps {
  name: string;
  className?: string;
}

/**
 * Large, parallax-scrolled brand name that reveals as you scroll into it.
 * The text scales from 0.85 → 1.0 and opacity 0 → 1 as the section enters
 * the viewport. It also has an infinite horizontal shimmer stroke on hover.
 */
export function BrandFooter({ name, className }: BrandFooterProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.82, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [60, 0]);

  // Horizontal scroll-linked drift — the brand name moves slightly opposite to scroll
  const { scrollYProgress: pageScroll } = useScroll();
  const x = useTransform(pageScroll, [0.8, 1], [0, -40]);

  const letters = name.split("");

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden py-8 border-t-4 border-border",
        className,
      )}
    >
      <motion.div
        style={{ scale, opacity, y, x }}
        className="flex items-center justify-center"
      >
        <h2
          className="font-black uppercase tracking-tighter leading-none text-foreground select-none"
          style={{ fontSize: "clamp(3rem, 12vw, 14rem)" }}
          aria-label={name}
        >
          {letters.map((letter, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: 0.04 * i,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{
                color: "hsl(var(--primary))",
                transition: { duration: 0.15 },
              }}
            >
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          ))}
        </h2>
      </motion.div>

      {/* Thin decorative line under the brand */}
      <motion.div
        className="absolute bottom-0 left-0 h-[3px] bg-primary"
        initial={{ width: 0 }}
        whileInView={{ width: "100%" }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      />
    </div>
  );
}
