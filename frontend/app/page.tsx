"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { MarqueeFooter } from "@/components/ui/marquee-footer";
import { ArrowRight, Check, X, ExternalLink } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { InfiniteMarquee } from "@/components/ui/infinite-marquee";
import { GithubIcon } from "@/components/ui/github";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { MicIcon } from "@/components/ui/mic";
import { LockKeyholeOpenIcon } from "@/components/ui/lock-keyhole-open";

// ── Animation helpers ──────────────────────────────────────────────────────────
// Set this to false to disable all scroll and entry animations for static screenshots
export const ENABLE_PAGE_ANIMATIONS = true;

const EASE = [0.22, 1, 0.36, 1] as const;

function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const isVisible = !ENABLE_PAGE_ANIMATIONS || inView;

  return (
    <motion.div
      ref={ref}
      initial={ENABLE_PAGE_ANIMATIONS ? { opacity: 0, y: 40 } : false}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: ENABLE_PAGE_ANIMATIONS ? 0.65 : 0,
        delay: ENABLE_PAGE_ANIMATIONS ? delay : 0,
        ease: EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── SVG feature icons ──────────────────────────────────────────────────────────
const IconMap = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
    <rect
      x="4"
      y="4"
      width="10"
      height="10"
      className="fill-current opacity-40"
    />
    <rect
      x="19"
      y="4"
      width="10"
      height="10"
      className="fill-current opacity-70"
    />
    <rect
      x="34"
      y="4"
      width="10"
      height="10"
      className="fill-current opacity-40"
    />
    <rect
      x="4"
      y="19"
      width="10"
      height="10"
      className="fill-current opacity-70"
    />
    <rect x="19" y="19" width="10" height="10" className="fill-current" />
    <rect
      x="34"
      y="19"
      width="10"
      height="10"
      className="fill-current opacity-70"
    />
    <rect
      x="4"
      y="34"
      width="10"
      height="10"
      className="fill-current opacity-40"
    />
    <rect
      x="19"
      y="34"
      width="10"
      height="10"
      className="fill-current opacity-70"
    />
    <rect
      x="34"
      y="34"
      width="10"
      height="10"
      className="fill-current opacity-40"
    />
    <circle
      cx="24"
      cy="24"
      r="5"
      className="fill-background stroke-current"
      strokeWidth="2"
    />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
    <path
      d="M24 4L6 12v14c0 9 8 16 18 20 10-4 18-11 18-20V12L24 4z"
      className="stroke-current fill-current opacity-20"
      strokeWidth="2"
    />
    <path
      d="M17 24l5 5 9-10"
      className="stroke-current"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconCamera = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
    <rect
      x="4"
      y="14"
      width="28"
      height="20"
      rx="3"
      className="stroke-current fill-current opacity-20"
      strokeWidth="2"
    />
    <path
      d="M32 20l12-6v20l-12-6V20z"
      className="stroke-current fill-current opacity-40"
      strokeWidth="2"
    />
    <circle cx="18" cy="24" r="5" className="stroke-current" strokeWidth="2" />
  </svg>
);

const IconChat = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
    <rect
      x="4"
      y="6"
      width="30"
      height="22"
      rx="3"
      className="stroke-current fill-current opacity-20"
      strokeWidth="2"
    />
    <path
      d="M8 32l4-4"
      className="stroke-current"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <rect
      x="14"
      y="20"
      width="30"
      height="22"
      rx="3"
      className="stroke-current fill-current opacity-40"
      strokeWidth="2"
    />
    <line
      x1="20"
      y1="28"
      x2="38"
      y2="28"
      className="stroke-current opacity-60"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="20"
      y1="33"
      x2="32"
      y2="33"
      className="stroke-current opacity-40"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// ── Comparison table data ──────────────────────────────────────────────────────
const COMPARISON = [
  {
    feature: "Spatial 2D Presence",
    av: true,
    gather: true,
    discord: false,
    zoom: false,
  },
  {
    feature: "Proximity Audio",
    av: true,
    gather: true,
    discord: false,
    zoom: false,
  },
  {
    feature: "Zone-Triggered Video",
    av: true,
    gather: false,
    discord: false,
    zoom: false,
  },
  {
    feature: "E2EE Text Messages",
    av: true,
    gather: false,
    discord: false,
    zoom: false,
  },
  {
    feature: "E2EE Audio / Video",
    av: true,
    gather: false,
    discord: true,
    zoom: true,
  },
  {
    feature: "Zero-Knowledge Server",
    av: true,
    gather: false,
    discord: false,
    zoom: false,
  },
  {
    feature: "No Plugin Required",
    av: true,
    gather: true,
    discord: false,
    zoom: false,
  },
];

const TECH_STACK = [
  { label: "Next.js 16", bg: "bg-foreground", text: "text-background" },
  { label: "React 19", bg: "bg-primary", text: "text-primary-foreground" },
  { label: "Phaser 3", bg: "bg-destructive", text: "text-white" },
  { label: "FastAPI", bg: "bg-primary", text: "text-primary-foreground" },
  { label: "LiveKit SFU", bg: "bg-foreground", text: "text-background" },
  { label: "PostgreSQL", bg: "bg-primary", text: "text-primary-foreground" },
  { label: "Redis", bg: "bg-destructive", text: "text-white" },
  { label: "TypeScript", bg: "bg-foreground", text: "text-background" },
  { label: "X25519 ECDH", bg: "bg-primary", text: "text-primary-foreground" },
  { label: "AES-256-GCM", bg: "bg-foreground", text: "text-background" },
  { label: "WebAuthn PRF", bg: "bg-primary", text: "text-primary-foreground" },
  { label: "Grid Engine", bg: "bg-destructive", text: "text-white" },
];

const FEATURES = [
  {
    Icon: IconMap,
    tag: "SPATIAL",
    title: "The World Drives Everything",
    body: "Walk up to a colleague and their voice fades in automatically. Step into a Room zone and a video conference opens — no buttons, no scheduling. Your tile position is the interface.",
    bullets: [
      "4-directional movement on Tiled maps",
      "Earshot radius ring overlay",
      "20Hz real-time position sync",
      "3D HRTF spatial audio via Web Audio API",
    ],
  },
  {
    Icon: IconShield,
    tag: "PRIVACY",
    title: "Zero-Knowledge Encryption",
    body: "Every message is encrypted before it leaves your browser. The server stores opaque ciphertexts it can never read. Private keys never leave your device — not even for backup.",
    bullets: [
      "X25519 ECDH + HKDF + AES-256-GCM",
      "WebAuthn PRF biometric key backup",
      "Epoch-based forward secrecy",
      "Web Crypto API — no third-party libs",
    ],
  },
  {
    Icon: IconCamera,
    tag: "VIDEO",
    title: "Zone-Triggered Conferences",
    body: "Walk into any Room zone and a LiveKit WebRTC video session opens automatically. Walk out and it closes. The map topology defines who can meet — naturally.",
    bullets: [
      "LiveKit SFU WebRTC streams",
      "Expandable strip → full conference",
      "Screen sharing inside zones",
      "Guest invite links via JWT",
    ],
  },
  {
    Icon: IconChat,
    tag: "MESSAGING",
    title: "Persistent Encrypted Channels",
    body: "Discord-style text channels and 1-on-1 DMs, all zero-knowledge encrypted. Per-device ciphertext slices mean every trusted device can read its own messages independently.",
    bullets: [
      "Channel E2EE with epoch rotation",
      "Per-device DM ciphertexts",
      "Real-time delivery via WebSocket",
      "Full message edit & soft-delete",
    ],
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create a Space",
    body: "Launch a server, pick a tile map (classroom or campus layout), and set it public or private. The backend parses spawn points and zones automatically.",
  },
  {
    n: "02",
    title: "Walk In",
    body: "Pick your avatar — Bob, Alex, Adam, or Amelia. Your character spawns at your last saved position and other players appear in real time.",
  },
  {
    n: "03",
    title: "Collaborate Naturally",
    body: "Walk up to someone to talk, enter a Room to video call, or type in an encrypted channel. Your position is the only control you need.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const stored = localStorage.getItem("username");
    if (token) {
      setIsLoggedIn(true);
      setUsername(stored);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-4 border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ rotate: 6, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
              className="relative w-10 h-10 bg-primary border-2 border-border shadow-shadow flex items-center justify-center overflow-hidden"
              style={{ imageRendering: "pixelated" }}
            >
              {/* pixel AV */}
              <span className="text-primary-foreground font-black text-sm select-none">
                AV
              </span>
              {/* scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
                }}
              />
            </motion.div>
            <span className="text-xl font-black uppercase tracking-tight hidden sm:block">
              AtriumVerse
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold uppercase tracking-wide">
            {["#features", "#how-it-works", "#tech"].map((href) => (
              <Link
                key={href}
                href={href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {href.slice(1).replace(/-/g, " ")}
              </Link>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            <ModeToggle />
            {isLoggedIn ? (
              <>
                <span className="hidden sm:block text-sm font-bold truncate max-w-[6rem] border-2 border-border px-3 py-1.5">
                  {username}
                </span>
                <Link href="/dashboard">
                  <Button className="font-black gap-2">
                    Dashboard <ArrowRight size={14} />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    variant="neutral"
                    className="font-black hidden sm:inline-flex"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="font-black gap-2">
                    Get Started <ArrowRight size={14} />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="relative border-b-4 border-border overflow-hidden">
        {/* grid bg */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* decorative blocks */}
        <motion.div
          className="absolute top-10 right-6 w-24 h-24 bg-primary border-4 border-border hidden lg:block"
          animate={{ rotate: [6, 9, 6] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-12 left-6 w-16 h-16 bg-foreground border-4 border-border hidden lg:block"
          animate={{ rotate: [-3, -7, -3] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 left-1/3 w-6 h-6 bg-primary/40 border-2 border-border hidden xl:block"
          animate={{ y: [-8, 8, -8] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="max-w-7xl mx-auto px-6 py-20 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative">
          {/* Left: copy */}
          <div>
            {/* tag */}
            <motion.div
              initial={ENABLE_PAGE_ANIMATIONS ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: ENABLE_PAGE_ANIMATIONS ? 0.5 : 0,
                ease: EASE,
              }}
              className="inline-flex items-center gap-2 border-4 border-border bg-primary px-4 py-2 shadow-shadow mb-8"
            >
              <span className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
              <span className="font-black text-xs uppercase tracking-widest text-primary-foreground">
                Virtual Collaboration
              </span>
            </motion.div>

            {/* headline */}
            {["Walk in,", "Talk live,", "Work together."].map((line, i) => (
              <motion.h1
                key={line}
                initial={
                  ENABLE_PAGE_ANIMATIONS ? { opacity: 0, x: -40 } : false
                }
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: ENABLE_PAGE_ANIMATIONS ? 0.6 : 0,
                  delay: ENABLE_PAGE_ANIMATIONS ? 0.1 + i * 0.12 : 0,
                  ease: EASE,
                }}
                className={`font-black uppercase tracking-tight leading-[0.88] text-5xl md:text-7xl xl:text-8xl block ${
                  i === 1 ? "text-primary" : ""
                }`}
              >
                {line}
              </motion.h1>
            ))}

            {/* <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              className="mt-8 text-lg md:text-xl text-muted-foreground font-medium max-w-lg leading-relaxed"
            >
              A tile-based virtual office where your{" "}
              <strong className="text-foreground">
                position drives everything
              </strong>{" "}
              — proximity audio, zone video, and end-to-end encrypted messaging.
              All in one browser tab.
            </motion.p> */}

            {/* feature pills */}
            <motion.div
              initial={ENABLE_PAGE_ANIMATIONS ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: ENABLE_PAGE_ANIMATIONS ? 0.65 : 0 }}
              className="flex flex-wrap gap-2 mt-6"
            >
              {[
                "No Plugin",
                "E2EE",
                "Zero-Knowledge",
                "WebRTC",
                "Spatial Audio",
              ].map((tag) => (
                <span
                  key={tag}
                  className="border-2 border-border px-3 py-1 text-xs font-black uppercase tracking-wider bg-card shadow-shadow"
                >
                  {tag}
                </span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={ENABLE_PAGE_ANIMATIONS ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: ENABLE_PAGE_ANIMATIONS ? 0.75 : 0,
                ease: EASE,
              }}
              className="flex flex-wrap gap-3 mt-8"
            >
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                <Button
                  size="lg"
                  className="text-base font-black px-8 py-6 gap-2 shadow-shadow"
                >
                  {isLoggedIn ? "Open Dashboard" : "Start Free"}{" "}
                  <ArrowRightIcon size={16} />
                </Button>
              </Link>
              <Link
                href="https://github.com/Parth-12pm/AtriumVerse"
                target="_blank"
                rel="noopener"
              >
                <Button
                  size="lg"
                  variant="neutral"
                  className="text-base font-black px-8 py-6 gap-2"
                >
                  <GithubIcon size={16} /> GitHub
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Right: game screenshot */}
          <motion.div
            initial={
              ENABLE_PAGE_ANIMATIONS ? { opacity: 0, y: 60, rotate: -1 } : false
            }
            animate={{ opacity: 1, y: 0, rotate: -1 }}
            transition={{
              duration: ENABLE_PAGE_ANIMATIONS ? 0.8 : 0,
              delay: ENABLE_PAGE_ANIMATIONS ? 0.3 : 0,
              ease: EASE,
            }}
            className="relative"
          >
            {/* glow behind */}
            <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full pointer-events-none" />

            <div className="relative border-4 border-border shadow-[8px_8px_0px_0px_var(--border)] overflow-hidden">
              <Image
                src="/phaser_assets/map_thumbnails/image.png"
                alt="AtriumVerse game world — office map with player avatars"
                width={900}
                height={600}
                className="w-full object-cover"
                style={{ imageRendering: "pixelated" }}
                priority
              />
              {/* scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.4) 3px, rgba(0,0,0,0.4) 4px)",
                }}
              />
              {/* live badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-background/90 border-2 border-border px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Live World
                </span>
              </div>
            </div>

            {/* floating stat cards */}
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-5 -left-6 border-4 border-border bg-card shadow-shadow px-4 py-3 hidden sm:block"
            >
              <p className="text-xs font-black uppercase text-muted-foreground">
                Proximity Audio
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {/* lucide-animated Mic */}
                <MicIcon size={18} />
                <span className="text-sm font-black">LiveKit SFU + HRTF</span>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [4, -4, 4] }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute -top-5 -right-6 border-4 border-border bg-primary shadow-shadow px-4 py-3 hidden sm:block"
            >
              <p className="text-xs font-black uppercase text-primary-foreground/70">
                Encryption
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {/* lucide-animated Lock */}
                <LockKeyholeOpenIcon size={18} />
                <span className="text-sm font-black text-primary-foreground">
                  X25519 + AES-256
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── MARQUEE STRIP ───────────────────────────────────────────────────── */}
      <section className="border-b-4 border-border bg-foreground text-background py-4 overflow-hidden">
        <InfiniteMarquee
          items={[
            "Spatial Presence",
            "Proximity Audio",
            "Zone-Triggered Video",
            "Zero-Knowledge E2EE",
            "WebRTC + LiveKit",
            "X25519 ECDH",
            "AES-256-GCM",
            "WebAuthn PRF",
            "Phaser 3",
            "Forward Secrecy",
            "No Plugin",
            "FastAPI Backend",
          ]}
          speed={40}
          itemClassName="text-background/80 font-black text-sm"
        />
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" className="border-b-4 border-border">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <FadeUp>
            <div className="mb-16">
              <span className="inline-block border-4 border-border bg-card px-3 py-1 shadow-shadow font-black text-xs uppercase tracking-widest mb-4">
                Features
              </span>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight">
                Everything in one world
              </h2>
              <p className="text-muted-foreground mt-3 font-medium max-w-xl">
                No more switching between Gather for presence, Discord for chat,
                and Zoom for calls.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feat, i) => (
              <FadeUp key={feat.title} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="border-4 border-border bg-card shadow-shadow h-full flex flex-col"
                >
                  {/* header bar */}
                  <div className="border-b-4 border-border px-6 py-4 flex items-center gap-4 bg-primary/5">
                    <div className="w-14 h-14 border-2 border-border bg-primary/10 flex items-center justify-center p-3 text-foreground flex-shrink-0">
                      <feat.Icon />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                        {feat.tag}
                      </span>
                      <h3 className="text-xl font-black uppercase leading-tight">
                        {feat.title}
                      </h3>
                    </div>
                  </div>

                  {/* body */}
                  <div className="px-6 py-5 flex flex-col gap-4 flex-1">
                    <p className="text-muted-foreground font-medium leading-relaxed">
                      {feat.body}
                    </p>
                    <ul className="mt-auto space-y-2">
                      {feat.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-center gap-2 text-sm font-bold"
                        >
                          <Check
                            size={14}
                            className="text-primary flex-shrink-0"
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────────────────────── */}
      <section className="border-b-4 border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <FadeUp>
            <div className="mb-12">
              <span className="inline-block border-4 border-border bg-background px-3 py-1 shadow-shadow font-black text-xs uppercase tracking-widest mb-4">
                Comparison
              </span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
                Why not just use Discord?
              </h2>
              <p className="text-muted-foreground mt-3 font-medium">
                Discord added audio/video E2EE in 2024 — but explicitly excludes
                all text messages. Gather.town has spatial presence but stores
                messages as plaintext. AtriumVerse is the only platform that
                closes all three gaps.
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="border-4 border-border overflow-hidden shadow-shadow">
              {/* table header */}
              <div className="grid grid-cols-5 border-b-4 border-border bg-foreground text-background">
                <div className="col-span-1 px-4 py-3 font-black text-xs uppercase tracking-wider">
                  Feature
                </div>
                {["AtriumVerse", "Gather.town", "Discord", "Zoom"].map((p) => (
                  <div
                    key={p}
                    className={`px-4 py-3 font-black text-xs uppercase tracking-wider text-center ${p === "AtriumVerse" ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {p}
                  </div>
                ))}
              </div>

              {COMPARISON.map((row, i) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-5 border-b-2 border-border last:border-0 ${i % 2 === 0 ? "bg-card" : "bg-background"}`}
                >
                  {/* FIX: Removed col-span-5 and added flex & items-center */}
                  <div className="flex items-center px-4 py-3 font-bold text-sm">
                    {row.feature}
                  </div>

                  {[row.av, row.gather, row.discord, row.zoom].map((has, j) => (
                    <div
                      key={j}
                      className={`px-4 py-3 flex items-center justify-center ${j === 0 ? "bg-primary/10" : ""}`}
                    >
                      {has ? (
                        <Check
                          size={16}
                          className={
                            j === 0 ? "text-primary" : "text-muted-foreground"
                          }
                          strokeWidth={4}
                        />
                      ) : (
                        <X
                          size={16}
                          className="text-destructive/50"
                          strokeWidth={4}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 font-medium">
              * Discord added audio/video E2EE via DAVE protocol (Sept 2024) but
              explicitly excludes text. Gather.town free tier capped at 10 users
              (2025).
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="border-b-4 border-border bg-foreground text-background"
      >
        <div className="max-w-7xl mx-auto px-6 py-24">
          <FadeUp>
            <div className="mb-16">
              <span className="inline-block border-4 border-background/20 bg-background/10 px-3 py-1 font-black text-xs uppercase tracking-widest mb-4 text-background">
                How It Works
              </span>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-background">
                Three steps to
                <br />
                your virtual office
              </h2>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-background/20">
            {STEPS.map((step, i) => (
              <FadeUp key={step.n} delay={i * 0.1}>
                <div
                  className={`p-8 ${i < 2 ? "border-r-4 border-background/20" : ""} h-full`}
                >
                  {/* big number */}
                  <div className="text-[80px] font-black leading-none mb-6 select-none">
                    {step.n}
                  </div>
                  {/* pixel step indicator */}
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-4 h-4 bg-primary border-2 border-background/40"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-background/40">
                      Step {step.n}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black uppercase mb-4 text-background">
                    {step.title}
                  </h3>
                  <p className="text-background/60 font-medium leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ──────────────────────────────────────────────────────── */}
      <section id="tech" className="border-b-4 border-border">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <FadeUp className="mb-12">
            <span className="inline-block border-4 border-border bg-card px-3 py-1 shadow-shadow font-black text-xs uppercase tracking-widest mb-4">
              Stack
            </span>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
              Built with proven tools
            </h2>
            <p className="text-muted-foreground mt-3 font-medium">
              No exotic dependencies. The entire encryption stack runs on the
              browser's built-in Web Crypto API.
            </p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="flex flex-wrap gap-3">
              {TECH_STACK.map((tech, i) => (
                <motion.span
                  key={tech.label}
                  initial={
                    ENABLE_PAGE_ANIMATIONS ? { opacity: 0, scale: 0.8 } : false
                  }
                  animate={
                    ENABLE_PAGE_ANIMATIONS
                      ? undefined
                      : { opacity: 1, scale: 1 }
                  }
                  whileInView={
                    ENABLE_PAGE_ANIMATIONS
                      ? { opacity: 1, scale: 1 }
                      : undefined
                  }
                  viewport={{ once: true }}
                  transition={{
                    delay: ENABLE_PAGE_ANIMATIONS ? i * 0.04 : 0,
                    ease: EASE,
                  }}
                  whileHover={{ y: -3, scale: 1.05 }}
                  className={`${tech.bg} ${tech.text} border-2 border-border px-4 py-2 font-black text-sm uppercase tracking-wider shadow-shadow cursor-default`}
                >
                  {tech.label}
                </motion.span>
              ))}
            </div>
          </FadeUp>

          {/* architecture quote */}
          <FadeUp delay={0.2}>
            <div className="mt-12 border-l-8 border-primary pl-6 py-2">
              <p className="text-lg font-black italic">
                "The server never receives a plaintext message or private key at
                any point."
              </p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">
                — AtriumVerse architecture guarantee
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── E2EE EXPLAINER ──────────────────────────────────────────────────── */}
      <section className="border-b-4 border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <FadeUp>
            <span className="inline-block border-4 border-border bg-background px-3 py-1 shadow-shadow font-black text-xs uppercase tracking-widest mb-4">
              Security
            </span>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-8">
              How the encryption works
            </h2>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                step: "1",
                title: "Keypair Generation",
                body: "On first login your browser generates an X25519 keypair. The public key goes to the server. The private key is stored only in IndexedDB — it never leaves your device.",
              },
              {
                step: "2",
                title: "Key Backup",
                body: "You back up your private key using Face ID / Windows Hello (WebAuthn PRF) or a passphrase. The encrypted blob is stored server-side, unreadable without your biometric.",
              },
              {
                step: "3",
                title: "Sending a DM",
                body: "ECDH between your private key and the recipient's public key produces a shared secret. HKDF(secret, message_id, 'dm-epoch:N') derives a per-message AES-256-GCM key.",
              },
              {
                step: "4",
                title: "Forward Secrecy",
                body: "When a member leaves a channel the epoch increments, a new channel key is distributed to remaining devices, and the departing member cannot decrypt future messages.",
              },
            ].map((item, i) => (
              <FadeUp key={item.step} delay={i * 0.08}>
                <div className="border-4 border-border bg-background shadow-shadow p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-primary border-2 border-border flex items-center justify-center font-black text-primary-foreground text-sm">
                      {item.step}
                    </div>
                    <h3 className="font-black uppercase text-sm tracking-wide">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECOND MAP ──────────────────────────────────────────────────────── */}
      <section className="border-b-4 border-border">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <FadeUp>
            <div className="mb-10">
              <span className="inline-block border-4 border-border bg-card px-3 py-1 shadow-shadow font-black text-xs uppercase tracking-widest mb-4">
                Maps
              </span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
                Multiple tile worlds
              </h2>
              <p className="text-muted-foreground mt-3 font-medium">
                Choose a classroom or campus layout — or upload your own Tiled
                JSON map.
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
              {[
                {
                  src: "/phaser_assets/map_thumbnails/final_map.png",
                  label: "Classroom Space",
                },
                {
                  src: "/phaser_assets/map_thumbnails/map1.png",
                  label: "Campus Space",
                },
              ].map((m) => (
                <motion.div
                  key={m.label}
                  whileHover={{ y: -4 }}
                  className="max-w-lg border-4 border-border shadow-shadow overflow-hidden"
                >
                  <div className="border-b-4 border-border bg-muted px-2 py-2 flex items-center gap-2">
                    <div
                      className="w-3 h-3 bg-primary border border-border"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <span className="font-black text-xs uppercase tracking-wider">
                      {m.label}
                    </span>
                  </div>
                  <Image
                    src={m.src}
                    alt={m.label}
                    width={500}
                    height={250}
                    className="w-full object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                </motion.div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="border-b-4 border-border bg-primary">
        <div className="max-w-5xl mx-auto px-6 py-28 text-center relative overflow-hidden">
          {/* corner decoration */}
          {[
            "top-0 left-0 border-b-4 border-r-4",
            "top-0 right-0 border-b-4 border-l-4",
            "bottom-0 left-0 border-t-4 border-r-4",
            "bottom-0 right-0 border-t-4 border-l-4",
          ].map((pos) => (
            <div
              key={pos}
              className={`absolute w-16 h-16 bg-primary-foreground/10 border-border ${pos}`}
            />
          ))}
          {/* pixel grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <FadeUp>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-primary-foreground mb-6 relative">
              Ready to walk in?
            </h2>
            <p className="text-xl text-primary-foreground/70 mb-10 max-w-xl mx-auto font-medium relative">
              Create your virtual office in seconds. No install, no plugins, no
              excuses.
            </p>
            <div className="flex flex-wrap justify-center gap-4 relative">
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                <Button
                  size="lg"
                  variant="neutral"
                  className="text-xl font-black px-10 py-7 gap-3 shadow-shadow"
                >
                  {isLoggedIn ? "Open Dashboard" : "Get Started Free"}{" "}
                  <ArrowRight size={20} />
                </Button>
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <MarqueeFooter />
    </div>
  );
}
