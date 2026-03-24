"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { MarqueeFooter } from "@/components/ui/marquee-footer";
import { ArrowRight, MessageSquare } from "lucide-react";
import { LockIcon } from "@/components/ui/lock";
import { ZapIcon } from "@/components/ui/zap";
import { UsersIcon } from "@/components/ui/users";
import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// ── Animation Variants ───────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUsername = localStorage.getItem("username");
    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoggedIn(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername(storedUsername);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ── NAVBAR ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-4 border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              className="w-10 h-10 bg-primary border-2 border-border shadow-shadow flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-primary-foreground font-black text-sm">
                AV
              </span>
            </motion.div>
            <span className="text-xl font-black uppercase tracking-tight">
              AtriumVerse
            </span>
          </Link>

          {/* Nav right */}
          <nav className="flex items-center gap-3">
            <ModeToggle />
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border-2 border-border bg-card shadow-shadow">
                  <span className="text-sm font-black truncate max-w-24">
                    {username}
                  </span>
                </div>
                <Link href="/dashboard">
                  <Button className="font-black gap-2">
                    Dashboard <ArrowRight size={16} />
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="neutral" className="font-black">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="font-black gap-2">
                    Sign Up <ArrowRight size={16} />
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative border-b-4 border-border overflow-hidden">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Decorative blocks */}
        <motion.div
          className="absolute top-12 right-8 w-32 h-32 bg-primary border-4 border-border hidden lg:block"
          animate={{ rotate: [6, 8, 6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-16 left-8 w-20 h-20 bg-foreground border-4 border-border hidden lg:block"
          animate={{ rotate: [-3, -6, -3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="max-w-7xl mx-auto px-6 py-24 md:py-36 relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <AnimatedSection>
            {/* Tag */}
            <motion.div variants={fadeUp} className="inline-block mb-6">
              <span className="inline-flex items-center gap-2 border-4 border-border bg-primary px-4 py-2 shadow-shadow font-black text-sm uppercase tracking-wider text-primary-foreground">
                <span className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                Virtual Collaboration Platform
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="text-5xl md:text-8xl font-black uppercase tracking-tight leading-[0.9] mb-8"
            >
              Walk in,
              <br />
              <span
                className="text-primary"
                style={{ WebkitTextStroke: "2px currentColor" }}
              >
                Talk live,
              </span>
              <br />
              Work together.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-xl md:text-2xl max-w-2xl mb-10 font-medium text-muted-foreground"
            >
              A tile-based virtual office where your{" "}
              <strong className="text-foreground">
                position drives everything
              </strong>
              — proximity audio, zone video, end-to-end encrypted messaging —
              all in one open space.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                <Button
                  size="lg"
                  className="text-lg font-black px-8 py-6 gap-3"
                >
                  {isLoggedIn ? "Open Dashboard" : "Get Started Free"}
                  <ArrowRight size={20} />
                </Button>
              </Link>
              <Link href="#features">
                <Button
                  size="lg"
                  variant="neutral"
                  className="text-lg font-black px-8 py-6"
                >
                  See Features
                </Button>
              </Link>
            </motion.div>
          </AnimatedSection>

          {/* Hero image — actual screenshot mockup from picsum */}
          <motion.div
            className="border-4 border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
          >
            <Image
              src="/phaser_assets/map_thumbnails/image.png"
              alt="AtriumVerse virtual workspace"
              width={1200}
              height={1200}
              className="w-full object-cover"
              priority
            />
          </motion.div>
        </div>
      </section>

      {/* ── STAT STRIP ─────────────────────────────────────────────── */}
      <section className="border-b-4 border-border bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x-4 divide-border/20">
            {[
              { value: "100%", label: "Client-side Encryption" },
              { value: "0", label: "Plugins Required" },
              { value: "3-in-1", label: "Audio · Video · Chat" },
              { value: "E2EE", label: "Zero-Knowledge Protocol" },
            ].map((stat) => (
              <div key={stat.label} className="px-8 py-8 text-center">
                <div className="text-4xl md:text-5xl font-black text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-xs font-bold text-background/50 uppercase tracking-widest">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────── */}
      <section id="features" className="border-b-4 border-border">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="mb-16">
              <span className="inline-block border-4 border-border bg-card px-3 py-1 shadow-shadow font-black text-xs uppercase tracking-widest mb-4">
                Features
              </span>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight">
                Why AtriumVerse?
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  Icon: UsersIcon,
                  title: "Spatial Presence",
                  desc: "Walk up to colleagues and their voice fades in automatically. No meetings to schedule — just walk up and start talking.",
                  img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
                  accent: "bg-primary",
                },
                {
                  Icon: LockIcon,
                  title: "Zero-Knowledge E2EE",
                  desc: "Messages are encrypted before they leave your device. X25519 + AES-256-GCM. The server stores ciphertext it cannot read.",
                  img: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&q=80",
                  accent: "bg-foreground",
                },
                {
                  Icon: ZapIcon,
                  title: "Zone-Triggered Video",
                  desc: "Walk into a room zone — a video conference opens automatically. Walk out — it closes. No button to click, ever.",
                  img: "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=600&q=80",
                  accent: "bg-primary",
                },
                {
                  Icon: MessageSquare,
                  title: "Persistent Channels",
                  desc: "Full channel system with DMs, message history, and E2EE. Everything Discord and Slack have, plus spatial presence.",
                  img: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80",
                  accent: "bg-foreground",
                },
              ].map((feat, i) => (
                <motion.div
                  key={feat.title}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  className="border-4 border-border bg-card shadow-shadow overflow-hidden group"
                >
                  {/* Image header */}
                  <div className="relative h-48 overflow-hidden border-b-4 border-border">
                    <Image
                      src={feat.img}
                      alt={feat.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-foreground/40" />
                    <div
                      className={`absolute top-4 left-4 p-3 ${feat.accent} border-2 border-background`}
                    >
                      <feat.Icon
                        size={24}
                        className={
                          feat.accent === "bg-foreground"
                            ? "text-background"
                            : "text-primary-foreground"
                        }
                      />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-black uppercase mb-2">
                      {feat.title}
                    </h3>
                    <p className="text-muted-foreground font-medium">
                      {feat.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────── */}
      <section className="border-b-4 border-border bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="mb-16">
              <span className="inline-block border-4 border-background/20 bg-background/10 px-3 py-1 font-black text-xs uppercase tracking-widest mb-4 text-background">
                How It Works
              </span>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-background">
                Up & Running
                <br />
                in 3 Steps
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-background/20">
              {[
                {
                  step: "01",
                  title: "Create a Space",
                  desc: "Set up your virtual office. Pick a tile map, configure zones and rooms.",
                  img: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&q=80",
                },
                {
                  step: "02",
                  title: "Invite Your Team",
                  desc: "Share a link. Everyone gets an avatar and walks freely around the map.",
                  img: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80",
                },
                {
                  step: "03",
                  title: "Start Collaborating",
                  desc: "Walk up to talk, enter rooms for video, chat in encrypted channels.",
                  img: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=80",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  variants={fadeUp}
                  className={`p-8 ${i < 2 ? "border-r-4 border-background/20" : ""}`}
                >
                  <div className="text-7xl font-black text-background/10 mb-4 leading-none">
                    {item.step}
                  </div>
                  <div className="relative h-40 border-4 border-background/20 overflow-hidden mb-6">
                    <Image
                      src={item.img}
                      alt={item.title}
                      fill
                      className="object-cover opacity-60"
                    />
                  </div>
                  <h3 className="text-xl font-black uppercase mb-3 text-background">
                    {item.title}
                  </h3>
                  <p className="text-background/60 font-medium">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="border-b-4 border-border">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <AnimatedSection>
            <motion.div
              variants={fadeUp}
              className="border-4 border-border bg-primary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-12 md:p-20 text-center relative overflow-hidden"
            >
              {/* Decorative corner squares */}
              <div className="absolute top-0 left-0 w-16 h-16 bg-foreground/10 border-b-4 border-r-4 border-border" />
              <div className="absolute top-0 right-0 w-16 h-16 bg-foreground/10 border-b-4 border-l-4 border-border" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-foreground/10 border-t-4 border-r-4 border-border" />
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-foreground/10 border-t-4 border-l-4 border-border" />

              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-primary-foreground mb-6">
                Ready to Transform
                <br />
                Your Team?
              </h2>
              <p className="text-xl text-primary-foreground/70 mb-10 max-w-xl mx-auto font-medium">
                Join teams already using AtriumVerse for better remote
                collaboration.
              </p>
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                <Button
                  size="lg"
                  variant="neutral"
                  className="text-xl font-black px-10 py-7 gap-3"
                >
                  {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
                  <ArrowRight size={22} />
                </Button>
              </Link>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── MARQUEE FOOTER ─────────────────────────────────────────── */}
      <MarqueeFooter />
    </div>
  );
}
