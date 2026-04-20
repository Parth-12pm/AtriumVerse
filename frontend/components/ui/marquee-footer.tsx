"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { GithubIcon } from "./github";

// ── Pixel letter animation ─────────────────────────────────────────────────────
// Each letter scales in from a pixelated tiny version, simulating a
// low-res → high-res "game texture loading" effect.
// Set ENABLE_ANIMATIONS to true for scroll animations, false for static fully-visible state (useful for screenshots)
export const ENABLE_ANIMATIONS = true;

const BRAND = "ATRIUMVERSE";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function PixelLetter({ char, index }: { char: string; index: number }) {
  return (
    <motion.span
      custom={index}
      variants={{
        hidden: {
          opacity: 0,
          scale: 0.05,
          filter: "blur(4px)",
          y: 20,
        },
        visible: (i: number) => ({
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          y: 0,
          transition: {
            delay: ENABLE_ANIMATIONS ? i * 0.07 : 0,
            duration: ENABLE_ANIMATIONS ? 0.7 : 0,
            ease: EASE,
          },
        }),
      }}
      className="inline-block"
      style={{ imageRendering: "pixelated" }}
    >
      {char === " " ? "\u00A0" : char}
    </motion.span>
  );
}

// ── Scanline overlay ───────────────────────────────────────────────────────────
function Scanlines({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        background:
          "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.5) 3px, rgba(0,0,0,0.5) 4px)",
      }}
    />
  );
}

// ── Pixel grid background ──────────────────────────────────────────────────────
function PixelGrid({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        backgroundImage:
          "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    />
  );
}

// ── Blinking pixel cursor ──────────────────────────────────────────────────────
function PixelCursor({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      className="inline-block bg-current"
      // FIX: Changed to a blocky cursor and aligned to the text baseline
      style={{
        width: "0.1em",
        height: "0.7em",
        marginLeft: "0.08em",
        verticalAlign: "baseline",
      }}
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{
        duration: 1,
        delay,
        repeat: Infinity,
        ease: "linear",
        times: [0, 0.45, 0.5, 0.95],
      }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function MarqueeFooter() {
  // Set ANIMATE_ONCE to true to animate only once, false to animate on every scroll
  const ANIMATE_ONCE = true;

  const logoRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(logoRef, { once: ANIMATE_ONCE, margin: "-80px" });
  const isVisible = !ENABLE_ANIMATIONS || isInView;
  const year = new Date().getFullYear();

  const LINKS = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    {
      label: "GitHub",
      href: "https://github.com/Parth-12pm/AtriumVerse",
      external: true,
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t-4 border-border bg-background">
      {/* ── Big animated logo ──────────────────────────────────────────────── */}
      <div
        ref={logoRef}
        className="relative border-b-4 border-border overflow-hidden py-16 md:py-24 select-none"
        aria-label="AtriumVerse"
      >
        <PixelGrid opacity={0.035} />
        <Scanlines opacity={0.04} />

        {/* decorative pixel blocks — game-themed */}
        {[
          { top: "12%", left: "2%", size: 20, bg: "bg-primary", delay: 0.3 },
          { top: "60%", left: "1%", size: 12, bg: "bg-foreground", delay: 0.6 },
          { top: "30%", right: "2%", size: 16, bg: "bg-primary", delay: 0.5 },
          {
            top: "70%",
            right: "1%",
            size: 10,
            bg: "bg-foreground",
            delay: 0.8,
          },
          { top: "5%", left: "20%", size: 8, bg: "bg-primary/40", delay: 1.0 },
          {
            top: "85%",
            right: "18%",
            size: 8,
            bg: "bg-primary/40",
            delay: 1.2,
          },
        ].map((b, i) => (
          <motion.div
            key={i}
            className={`absolute ${b.bg} border-2 border-border`}
            style={{
              width: b.size,
              height: b.size,
              top: b.top,
              left: (b as any).left,
              right: (b as any).right,
              imageRendering: "pixelated",
            }}
            initial={ENABLE_ANIMATIONS ? { opacity: 0, scale: 0 } : false}
            animate={isVisible ? { opacity: 1, scale: 1 } : {}}
            transition={{
              delay: ENABLE_ANIMATIONS ? b.delay : 0,
              duration: ENABLE_ANIMATIONS ? 0.4 : 0,
              ease: EASE,
            }}
          />
        ))}

        {/* the logo text */}
        <motion.div
          className="relative flex justify-center items-center px-4"
          initial={ENABLE_ANIMATIONS ? "hidden" : false}
          animate={isVisible ? "visible" : "hidden"}
        >
          <h2
            className="font-black uppercase tracking-tighter text-foreground leading-none text-center"
            style={{
              fontSize: "clamp(2.5rem, 11vw, 11rem)",
              imageRendering: "pixelated",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {BRAND.split("").map((char, i) => (
              <PixelLetter key={i} char={char} index={i} />
            ))}
            {/* blinking cursor at end — starts after all letters appear */}
            <motion.span
              className="inline-block" // <-- Add this class
              initial={ENABLE_ANIMATIONS ? { opacity: 0 } : false}
              animate={isVisible ? { opacity: 1 } : {}}
              transition={{
                delay: ENABLE_ANIMATIONS ? BRAND.length * 0.07 + 0.2 : 0,
              }}
            >
              <PixelCursor delay={BRAND.length * 0.07 + 0.2} />
            </motion.span>
          </h2>
        </motion.div>

        {/* bottom scan line sweep — "TV turn-on" effect */}
        {ENABLE_ANIMATIONS && (
          <motion.div
            className="absolute inset-x-0 h-[3px] bg-primary/60 pointer-events-none"
            style={{ top: "50%" }}
            initial={{ scaleX: 0, opacity: 1 }}
            animate={
              isInView
                ? { scaleX: [0, 1, 1], opacity: [1, 1, 0] }
                : { scaleX: 0, opacity: 1 }
            }
            transition={{
              duration: ENABLE_ANIMATIONS ? 1.2 : 0,
              ease: EASE,
              times: [0, 0.7, 1],
            }}
          />
        )}

        {/* tagline under logo */}
        <motion.p
          className="text-center text-muted-foreground font-bold uppercase tracking-[0.3em] text-sm mt-4 relative"
          initial={ENABLE_ANIMATIONS ? { opacity: 0, y: 10 } : false}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{
            delay: ENABLE_ANIMATIONS ? BRAND.length * 0.07 + 0.5 : 0,
            duration: ENABLE_ANIMATIONS ? 0.5 : 0,
            ease: EASE,
          }}
        >
          Walk in · Talk live · Work together
        </motion.p>
      </div>
      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <div className="border-t-4 border-border bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Left: logo mark + credit */}
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 bg-primary border-2 border-background/20 flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                style={{ imageRendering: "pixelated" }}
              >
                <span className="text-primary-foreground font-black text-sm">
                  AV
                </span>
                <Scanlines opacity={0.15} />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-wider">
                  AtriumVerse
                </p>
                <p className="text-xs font-bold text-background/30 uppercase tracking-wider">
                  © {year}
                </p>
              </div>
            </div>

            {/* Center: nav links */}
            <nav className="flex flex-wrap gap-x-6 gap-y-2">
              {LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={(link as any).external ? "_blank" : undefined}
                  rel={
                    (link as any).external ? "noopener noreferrer" : undefined
                  }
                  className="text-xs font-bold uppercase tracking-wider text-background/50 hover:text-background transition-colors flex items-center gap-1"
                >
                  {link.label}
                  {(link as any).external && <ExternalLink size={10} />}
                </Link>
              ))}
            </nav>

            <p className="text-xs text-background/40 font-medium mt-0.5">
              Built with ♥ at RGIT
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
