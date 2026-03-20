"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Video,
  Users,
  Zap,
  ArrowRight,
  Sparkles,
  Lock,
  Map,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUsername = localStorage.getItem("username");
    if (token) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navbar ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-4 border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg border-2 border-border shadow-shadow flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-black uppercase tracking-tight">
              AtriumVerse
            </span>
          </div>

          <nav className="flex items-center gap-3">
            <ModeToggle />
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border-2 border-border rounded-lg bg-primary/10">
                  <div className="w-7 h-7 bg-primary rounded-md border-2 border-border flex items-center justify-center">
                    <span className="text-xs font-black text-primary-foreground">
                      {username?.slice(0, 2).toUpperCase() ?? "??"}
                    </span>
                  </div>
                  <span className="text-sm font-bold">{username}</span>
                </div>
                <Link href="/dashboard">
                  <Button className="font-bold">
                    Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="neutral" className="font-bold">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="font-bold">
                    Sign Up <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="container mx-auto px-4 py-20 md:py-32 relative overflow-hidden">
        {/* Decorative offset blocks — neobrutalism flair */}
        <div className="absolute top-12 right-8 w-24 h-24 bg-primary border-4 border-border rotate-6 opacity-20 hidden md:block" />
        <div className="absolute bottom-12 left-4 w-16 h-16 bg-accent border-4 border-border -rotate-3 opacity-20 hidden md:block" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-primary border-2 border-border shadow-shadow rounded-lg">
            <span className="text-sm font-black uppercase tracking-wider text-primary-foreground">
              Virtual Collaboration Platform
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight mb-6 leading-tight">
            Virtual Space
            <br />
            <span className="text-primary underline decoration-4 underline-offset-4">
              For Real Teams
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto font-medium">
            Walk around, meet your teammates, and collaborate naturally —{" "}
            <span className="font-bold text-foreground">
              just like a real office
            </span>
            , but from anywhere.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isLoggedIn ? (
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="text-lg font-black px-8 py-6 shadow-shadow"
                >
                  Open Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button
                  size="lg"
                  className="text-lg font-black px-8 py-6 shadow-shadow"
                >
                  Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
            <Link href="#features">
              <Button
                size="lg"
                variant="neutral"
                className="text-lg font-black px-8 py-6"
              >
                See Features
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero stat strip */}
        <div className="mt-16 grid grid-cols-3 max-w-2xl mx-auto gap-4">
          {[
            { value: "2D Map", label: "Spatial World" },
            { value: "E2EE", label: "Encrypted Chats" },
            { value: "Live", label: "Video Rooms" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-4 border-border bg-card shadow-shadow rounded-lg p-4 text-center"
            >
              <div className="text-2xl font-black text-primary">
                {stat.value}
              </div>
              <div className="text-sm font-bold text-muted-foreground uppercase">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────── */}
      <section
        id="features"
        className="container mx-auto px-4 py-20 border-t-4 border-border"
      >
        <div className="text-center mb-16">
          <div className="inline-block mb-4 px-3 py-1 bg-accent border-2 border-border rounded-md shadow-shadow">
            <span className="text-xs font-black uppercase tracking-widest text-accent-foreground">
              Features
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
            Why AtriumVerse?
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto font-medium">
            Collaboration the way it should be — spontaneous, natural, and
            engaging.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
          {[
            {
              icon: Video,
              title: "Spatial Video",
              color: "bg-primary",
              textColor: "text-primary-foreground",
              bg: "bg-primary/10",
              desc: "Video calls that feel natural. Walk up to colleagues to start a conversation, walk away to end it.",
            },
            {
              icon: Users,
              title: "Team Presence",
              color: "bg-secondary",
              textColor: "text-secondary-foreground",
              bg: "bg-secondary/30",
              desc: "See who's around, who's busy, and who's available. Build team culture remotely.",
            },
            {
              icon: Zap,
              title: "Instant Rooms",
              color: "bg-accent",
              textColor: "text-accent-foreground",
              bg: "bg-accent/20",
              desc: "No scheduling needed. Walk into a meeting room and your video turns on automatically.",
            },
            {
              icon: Lock,
              title: "E2E Encrypted",
              color: "bg-primary",
              textColor: "text-primary-foreground",
              bg: "bg-primary/10",
              desc: "All channel messages are end-to-end encrypted. Only your team can read them — not even the server.",
            },
          ].map((feat) => (
            <Card
              key={feat.title}
              className={`${feat.bg} border-4 border-border shadow-shadow hover:-translate-y-1 transition-transform`}
            >
              <CardHeader>
                <div
                  className={`w-14 h-14 ${feat.color} rounded-lg border-2 border-border shadow-shadow flex items-center justify-center mb-4`}
                >
                  <feat.icon className={`w-7 h-7 ${feat.textColor}`} />
                </div>
                <CardTitle className="text-xl font-black uppercase">
                  {feat.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground font-medium">{feat.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────── */}
      <section className="container mx-auto px-4 py-20 border-t-4 border-border">
        <div className="text-center mb-16">
          <div className="inline-block mb-4 px-3 py-1 bg-primary border-2 border-border rounded-md shadow-shadow">
            <span className="text-xs font-black uppercase tracking-widest text-primary-foreground">
              How It Works
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
            Up &amp; Running in 3 Steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              step: "01",
              icon: Map,
              title: "Create a Space",
              desc: "Set up your virtual office in seconds. Pick a map and configure your workspace.",
            },
            {
              step: "02",
              icon: Users,
              title: "Invite Your Team",
              desc: "Share a link. Everyone joins with their own avatar and moves freely around the map.",
            },
            {
              step: "03",
              icon: MessageSquare,
              title: "Start Collaborating",
              desc: "Walk up to teammates to talk, join rooms for video calls, chat in encrypted channels.",
            },
          ].map((item, i) => (
            <div key={item.step} className="relative">
              {/* Connector line */}
              {i < 2 && (
                <div className="hidden md:block absolute top-8 left-full w-8 h-1 bg-border z-10" />
              )}
              <div className="border-4 border-border bg-card shadow-shadow rounded-lg p-6 text-center hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full border-4 border-border shadow-shadow flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-black">{item.step}</span>
                </div>
                <div className="w-10 h-10 bg-primary/10 border-2 border-border rounded-lg flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-black uppercase mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────── */}
      <section className="container mx-auto px-4 py-20 border-t-4 border-border">
        <div className="bg-primary border-4 border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-lg p-8 md:p-14 text-center relative overflow-hidden">
          {/* Decorative dots */}
          <div className="absolute top-4 left-4 w-6 h-6 bg-primary-foreground/20 border-2 border-primary-foreground/30 rounded-full" />
          <div className="absolute bottom-4 right-6 w-10 h-10 bg-primary-foreground/10 border-2 border-primary-foreground/20 rotate-12 rounded-md" />

          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-primary-foreground mb-4">
            Ready to Transform Your Team?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto font-medium">
            Join teams already using AtriumVerse for better remote
            collaboration.
          </p>
          {isLoggedIn ? (
            <Link href="/dashboard">
              <Button
                size="lg"
                variant="neutral"
                className="text-lg font-black px-8 py-6 shadow-shadow"
              >
                Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Link href="/register">
              <Button
                size="lg"
                variant="neutral"
                className="text-lg font-black px-8 py-6 shadow-shadow"
              >
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="border-t-4 border-border bg-secondary/20 py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg border-2 border-border flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-black uppercase">AtriumVerse</span>
            </div>

            <div className="flex gap-6">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="text-sm font-bold hover:underline underline-offset-4"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-bold hover:underline underline-offset-4"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm font-bold hover:underline underline-offset-4"
                  >
                    Sign Up
                  </Link>
                </>
              )}
              <Link
                href="#features"
                className="text-sm font-bold hover:underline underline-offset-4"
              >
                Features
              </Link>
            </div>

            <p className="text-sm text-muted-foreground font-medium">
              © 2026 AtriumVerse. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
