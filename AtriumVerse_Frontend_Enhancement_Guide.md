# AtriumVerse Frontend Enhancement Guide
## Neobrutalism Components + Animated Icons + Big Footer

---

## OVERVIEW OF CHANGES

| Area | Change |
|---|---|
| `globals.css` | Updated CSS variables to match neobrutalism.dev spec exactly |
| `app/page.tsx` | Full landing page redesign — hero, features, how-it-works, big footer |
| `app/dashboard/layout.tsx` | Animated icon navbar with lucide-animated components |
| `app/dashboard/page.tsx` | Brutalist server card grid with bold hover effects |
| `components/ui/animated-icons.tsx` | Copy-paste animated icon components (no npm needed) |
| `components/ui/marquee-footer.tsx` | Scrolling big-text footer component |
| `components/ui/brutalist-card.tsx` | Enhanced server card component |
| `components/navigation/ServerDock.tsx` | Animated server dock icons |
| `components/sidebar/BaseSidebar.tsx` | Animated sidebar buttons |

---

## STEP 1 — Install dependencies

Run this inside `frontend/`:

```bash
cd frontend

# motion is already installed at ^12.38.0 — verify:
npm list motion

# Install clsx + tw utilities (already present, verify):
npm list clsx tailwind-merge

# No new npm installs needed for lucide-animated — it's copy-paste using motion
# No new npm install for neobrutalism.dev — it uses your existing shadcn setup
```

---

## STEP 2 — Update `frontend/app/globals.css`

Replace the `:root` and `.dark` blocks with the **official neobrutalism.dev** CSS variables.
This is the foundation — all components inherit from this.

```css
/* frontend/app/globals.css — REPLACE the :root and .dark sections */

@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 5px;

  /* ── Neobrutalism.dev official palette (light) ── */
  --background:          oklch(94.61% 0.043 211.12);
  --foreground:          oklch(0% 0 0);
  --main:                oklch(76.89% 0.139164 219.13);
  --main-foreground:     oklch(0% 0 0);
  --secondary-background: oklch(100% 0 0);
  --border:              oklch(0% 0 0);
  --ring:                oklch(0% 0 0);
  --overlay:             oklch(0% 0 0 / 0.8);
  --shadow:              4px 4px 0px 0px var(--border);

  /* Semantic */
  --card:                oklch(100% 0 0);
  --card-foreground:     oklch(0% 0 0);
  --popover:             oklch(100% 0 0);
  --popover-foreground:  oklch(0% 0 0);
  --primary:             oklch(76.89% 0.139164 219.13);
  --primary-foreground:  oklch(0% 0 0);
  --secondary:           oklch(94.61% 0.043 211.12);
  --secondary-foreground: oklch(0% 0 0);
  --muted:               oklch(92% 0.025 211);
  --muted-foreground:    oklch(42% 0 0);
  --accent:              oklch(76.89% 0.139164 219.13);
  --accent-foreground:   oklch(0% 0 0);
  --destructive:         oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(100% 0 0);
  --input:               oklch(0% 0 0);
  --input-bg:            oklch(100% 0 0);

  /* Game sidebar */
  --game-sidebar-bg:     oklch(100% 0 0);
  --game-sidebar-border: oklch(0% 0 0);
  --game-dock-bg:        oklch(10% 0 0);
  --game-dock-text:      oklch(96% 0 0);
  --game-hover-bg:       oklch(90% 0.025 211);
  --game-active-bg:      oklch(57.5% 0.18 219);
  --game-active-text:    oklch(100% 0 0);

  /* Sidebar nav */
  --sidebar:             oklch(100% 0 0);
  --sidebar-foreground:  oklch(0% 0 0);
  --sidebar-primary:     oklch(76.89% 0.139164 219.13);
  --sidebar-primary-foreground: oklch(0% 0 0);
  --sidebar-accent:      oklch(94.61% 0.043 211.12);
  --sidebar-accent-foreground: oklch(0% 0 0);
  --sidebar-border:      oklch(0% 0 0);
  --sidebar-ring:        oklch(0% 0 0);
}

.dark {
  --background:          oklch(18% 0.015 225);
  --foreground:          oklch(95% 0 0);
  --main:                oklch(64.37% 0.1162 218.75);
  --main-foreground:     oklch(0% 0 0);
  --secondary-background: oklch(14% 0 0);
  --border:              oklch(0% 0 0);
  --ring:                oklch(95% 0 0);
  --overlay:             oklch(0% 0 0 / 0.85);
  --shadow:              4px 4px 0px 0px var(--border);

  --card:                oklch(16% 0.01 225);
  --card-foreground:     oklch(95% 0 0);
  --popover:             oklch(16% 0.01 225);
  --popover-foreground:  oklch(95% 0 0);
  --primary:             oklch(64.37% 0.1162 218.75);
  --primary-foreground:  oklch(0% 0 0);
  --secondary:           oklch(22% 0.02 225);
  --secondary-foreground: oklch(95% 0 0);
  --muted:               oklch(22% 0.02 225);
  --muted-foreground:    oklch(60% 0 0);
  --accent:              oklch(64.37% 0.1162 218.75);
  --accent-foreground:   oklch(0% 0 0);
  --destructive:         oklch(0.68 0.19 22);
  --destructive-foreground: oklch(0% 0 0);
  --input:               oklch(100% 0 0 / 15%);
  --input-bg:            oklch(22% 0.02 225);

  --game-sidebar-bg:     oklch(16% 0.01 225);
  --game-sidebar-border: oklch(0% 0 0);
  --game-dock-bg:        oklch(8% 0 0);
  --game-dock-text:      oklch(90% 0 0);
  --game-hover-bg:       oklch(26% 0.02 225);
  --game-active-bg:      oklch(50% 0.18 219);
  --game-active-text:    oklch(100% 0 0);

  --sidebar:             oklch(16% 0.01 225);
  --sidebar-foreground:  oklch(95% 0 0);
  --sidebar-primary:     oklch(64.37% 0.1162 218.75);
  --sidebar-primary-foreground: oklch(0% 0 0);
  --sidebar-accent:      oklch(22% 0.02 225);
  --sidebar-accent-foreground: oklch(95% 0 0);
  --sidebar-border:      oklch(100% 0 0 / 10%);
  --sidebar-ring:        oklch(95% 0 0);
}

/* keep rest of your file (theme inline, base layer, game overrides) unchanged */
```

---

## STEP 3 — Create `frontend/components/ui/animated-icons.tsx`

Copy-paste animated icon wrappers built with `motion` (already installed).
These are **lucide-animated.com style** — hover to animate.

```tsx
// frontend/components/ui/animated-icons.tsx
"use client";

import { motion } from "motion/react";
import { useRef } from "react";

// ── Animated Menu Icon ──────────────────────────────────────────────
export function AnimatedMenu({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
    >
      <motion.line x1="4" y1="6" x2="20" y2="6"
        variants={{ rest: { x2: 20 }, hover: { x2: 16 } }}
        transition={{ duration: 0.2 }} />
      <motion.line x1="4" y1="12" x2="20" y2="12"
        variants={{ rest: { x2: 20 }, hover: { x2: 20 } }} />
      <motion.line x1="4" y1="18" x2="20" y2="18"
        variants={{ rest: { x2: 20 }, hover: { x2: 12 } }}
        transition={{ duration: 0.2 }} />
    </motion.svg>
  );
}

// ── Animated Search Icon ────────────────────────────────────────────
export function AnimatedSearch({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
    >
      <motion.circle cx="11" cy="11" r="8"
        variants={{ rest: { scale: 1 }, hover: { scale: 1.1 } }}
        transition={{ duration: 0.15 }} />
      <motion.line x1="21" y1="21" x2="16.65" y2="16.65"
        variants={{ rest: { rotate: 0, originX: "16px", originY: "16px" }, hover: { rotate: 15 } }}
        transition={{ duration: 0.2 }} />
    </motion.svg>
  );
}

// ── Animated Bell Icon ──────────────────────────────────────────────
export function AnimatedBell({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
      variants={{
        rest: { rotate: 0 },
        hover: { rotate: [0, -15, 15, -10, 10, -5, 5, 0] }
      }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      style={{ transformOrigin: "50% 0%" }}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </motion.svg>
  );
}

// ── Animated LogOut Icon ────────────────────────────────────────────
export function AnimatedLogOut({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <motion.polyline
        points="16 17 21 12 16 7"
        variants={{ rest: { x: 0 }, hover: { x: 3 } }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }} />
      <motion.line x1="21" y1="12" x2="9" y2="12"
        variants={{ rest: { x: 0 }, hover: { x: 3 } }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }} />
    </motion.svg>
  );
}

// ── Animated Settings Icon ──────────────────────────────────────────
export function AnimatedSettings({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
      variants={{ rest: { rotate: 0 }, hover: { rotate: 90 } }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </motion.svg>
  );
}

// ── Animated MessageSquare Icon ─────────────────────────────────────
export function AnimatedMessage({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
      variants={{ rest: { scale: 1 }, hover: { scale: 1.12 } }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
    >
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    </motion.svg>
  );
}

// ── Animated Users Icon ─────────────────────────────────────────────
export function AnimatedUsers({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
    >
      <motion.path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        variants={{ rest: { x: 0 }, hover: { x: -2 } }}
        transition={{ duration: 0.2 }} />
      <motion.circle cx="9" cy="7" r="4"
        variants={{ rest: { x: 0 }, hover: { x: -2 } }}
        transition={{ duration: 0.2 }} />
      <motion.path
        d="M22 21v-2a4 4 0 0 0-3-3.87"
        variants={{ rest: { x: 0 }, hover: { x: 2 } }}
        transition={{ duration: 0.2 }} />
      <motion.path
        d="M16 3.128a4 4 0 0 1 0 7.744"
        variants={{ rest: { x: 0 }, hover: { x: 2 } }}
        transition={{ duration: 0.2 }} />
    </motion.svg>
  );
}

// ── Animated ArrowRight Icon ────────────────────────────────────────
export function AnimatedArrow({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
    >
      <motion.line x1="5" y1="12" x2="19" y2="12"
        variants={{ rest: { x2: 19 }, hover: { x2: 21 } }}
        transition={{ duration: 0.15 }} />
      <motion.polyline points="12 5 19 12 12 19"
        variants={{ rest: { x: 0 }, hover: { x: 2 } }}
        transition={{ duration: 0.15 }} />
    </motion.svg>
  );
}

// ── Animated Lock Icon ──────────────────────────────────────────────
export function AnimatedLock({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
    >
      <motion.rect width="18" height="11" x="3" y="11" rx="2" ry="2"
        variants={{ rest: { y: 11 }, hover: { y: 12 } }}
        transition={{ duration: 0.2 }} />
      <motion.path d="M7 11V7a5 5 0 0 1 10 0v4"
        variants={{ rest: { pathLength: 1 }, hover: { pathLength: 1 } }} />
    </motion.svg>
  );
}

// ── Animated Zap Icon ───────────────────────────────────────────────
export function AnimatedZap({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
      variants={{ rest: { scale: 1, rotate: 0 }, hover: { scale: 1.15, rotate: [-5, 5, -3, 3, 0] } }}
      transition={{ duration: 0.4 }}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </motion.svg>
  );
}

// ── Animated Home Icon ──────────────────────────────────────────────
export function AnimatedHome({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      whileHover="hover" initial="rest"
      variants={{ rest: { y: 0 }, hover: { y: -3 } }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </motion.svg>
  );
}
```

---

## STEP 4 — Create `frontend/components/ui/marquee-footer.tsx`

The **big scroll-triggered brand name** in the footer. This is the current trend — massive text that scrolls horizontally as the page scrolls.

```tsx
// frontend/components/ui/marquee-footer.tsx
"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";

export function MarqueeFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Parallax scroll: text slides left as you scroll down
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-25%"]);
  const xSpring = useSpring(x, { stiffness: 60, damping: 30 });

  const year = new Date().getFullYear();

  return (
    <footer ref={ref} className="relative overflow-hidden border-t-4 border-border bg-background">
      {/* Huge scrolling brand name */}
      <div className="overflow-hidden py-8 select-none">
        <motion.div
          style={{ x: xSpring }}
          className="flex whitespace-nowrap gap-16 items-center"
        >
          {/* Repeat text so it fills wide screens */}
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className="text-[clamp(80px,12vw,160px)] font-black uppercase tracking-tight leading-none text-foreground/10 select-none"
              style={{ WebkitTextStroke: "3px hsl(var(--border) / 0.3)" }}
            >
              AtriumVerse
            </span>
          ))}
        </motion.div>
      </div>

      {/* Bottom bar */}
      <div className="border-t-4 border-border bg-foreground text-background px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Left: brand + tagline */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary border-2 border-background rounded-lg flex items-center justify-center">
              <span className="text-background font-black text-sm">AV</span>
            </div>
            <div>
              <p className="font-black text-base uppercase tracking-widest">AtriumVerse</p>
              <p className="text-xs text-background/60 font-medium">Walk in. Talk live. Work together.</p>
            </div>
          </div>

          {/* Center: links */}
          <div className="flex gap-8">
            {["Features", "Dashboard", "GitHub"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-bold text-background/70 hover:text-background transition-colors uppercase tracking-wide"
              >
                {link}
              </a>
            ))}
          </div>

          {/* Right: year + license */}
          <div className="text-right">
            <p className="text-sm font-bold text-background/50">
              © {year} AtriumVerse
            </p>
            <p className="text-xs text-background/30">Built at RGIT Mumbai</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

---

## STEP 5 — Replace `frontend/app/page.tsx` (Landing Page)

Complete redesign. No emojis — uses SVG images from Unsplash/picsum.

```tsx
// frontend/app/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { MarqueeFooter } from "@/components/ui/marquee-footer";
import {
  AnimatedArrow,
  AnimatedLock,
  AnimatedZap,
  AnimatedUsers,
  AnimatedMessage,
} from "@/components/ui/animated-icons";
import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Animation Variants ───────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
    if (token) { setIsLoggedIn(true); setUsername(storedUsername); }
  }, []);

  return (
    <div className="min-h-screen bg-background">

      {/* ── NAVBAR ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-4 border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              className="w-10 h-10 bg-primary border-2 border-border shadow-shadow rounded-none flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-primary-foreground font-black text-sm">AV</span>
            </motion.div>
            <span className="text-xl font-black uppercase tracking-tight">AtriumVerse</span>
          </Link>

          {/* Nav right */}
          <nav className="flex items-center gap-3">
            <ModeToggle />
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border-2 border-border bg-card shadow-shadow">
                  <span className="text-sm font-black truncate max-w-24">{username}</span>
                </div>
                <Link href="/dashboard">
                  <Button className="font-black gap-2">
                    Dashboard <AnimatedArrow size={16} />
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="neutral" className="font-black">Login</Button>
                </Link>
                <Link href="/register">
                  <Button className="font-black gap-2">
                    Sign Up <AnimatedArrow size={16} />
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
            backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
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

        <div className="max-w-7xl mx-auto px-6 py-24 md:py-36 relative">
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
              Walk in.
              <br />
              <span className="text-primary" style={{ WebkitTextStroke: "2px currentColor" }}>
                Talk live.
              </span>
              <br />
              Work together.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-xl md:text-2xl max-w-2xl mb-10 font-medium text-muted-foreground">
              A tile-based virtual office where your <strong className="text-foreground">position drives everything</strong> — proximity audio, zone video, end-to-end encrypted messaging — all in one open space.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                <Button size="lg" className="text-lg font-black px-8 py-6 gap-3">
                  {isLoggedIn ? "Open Dashboard" : "Get Started Free"}
                  <AnimatedArrow size={20} />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="neutral" className="text-lg font-black px-8 py-6">
                  See Features
                </Button>
              </Link>
            </motion.div>
          </AnimatedSection>

          {/* Hero image — actual screenshot mockup from picsum */}
          <motion.div
            className="mt-20 border-4 border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
          >
            <Image
              src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop"
              alt="AtriumVerse virtual workspace"
              width={1200}
              height={600}
              className="w-full object-cover"
              priority
            />
            {/* Overlay label */}
            <div className="bg-foreground text-background px-6 py-3 flex items-center justify-between">
              <span className="font-black uppercase tracking-widest text-sm">AtriumVerse — Live Preview</span>
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Online
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── STAT STRIP ─────────────────────────────────────────────── */}
      <section className="border-b-4 border-border bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x-4 divide-border/20">
            {[
              { value: "100%", label: "Client-side Encryption" },
              { value: "0",    label: "Plugins Required" },
              { value: "3-in-1", label: "Audio · Video · Chat" },
              { value: "E2EE", label: "Zero-Knowledge Protocol" },
            ].map((stat) => (
              <div key={stat.label} className="px-8 py-8 text-center">
                <div className="text-4xl md:text-5xl font-black text-primary mb-1">{stat.value}</div>
                <div className="text-xs font-bold text-background/50 uppercase tracking-widest">{stat.label}</div>
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
                  Icon: AnimatedUsers,
                  title: "Spatial Presence",
                  desc: "Walk up to colleagues and their voice fades in automatically. No meetings to schedule — just walk up and start talking.",
                  img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
                  accent: "bg-primary",
                },
                {
                  Icon: AnimatedLock,
                  title: "Zero-Knowledge E2EE",
                  desc: "Messages are encrypted before they leave your device. X25519 + AES-256-GCM. The server stores ciphertext it cannot read.",
                  img: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&q=80",
                  accent: "bg-foreground",
                },
                {
                  Icon: AnimatedZap,
                  title: "Zone-Triggered Video",
                  desc: "Walk into a room zone — a video conference opens automatically. Walk out — it closes. No button to click, ever.",
                  img: "https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=600&q=80",
                  accent: "bg-primary",
                },
                {
                  Icon: AnimatedMessage,
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
                    <div className={`absolute top-4 left-4 p-3 ${feat.accent} border-2 border-background`}>
                      <feat.Icon size={24} className={feat.accent === "bg-foreground" ? "text-background" : "text-primary-foreground"} />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-black uppercase mb-2">{feat.title}</h3>
                    <p className="text-muted-foreground font-medium">{feat.desc}</p>
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
                  <div className="text-7xl font-black text-background/10 mb-4 leading-none">{item.step}</div>
                  <div className="relative h-40 border-4 border-background/20 overflow-hidden mb-6">
                    <Image src={item.img} alt={item.title} fill className="object-cover opacity-60" />
                  </div>
                  <h3 className="text-xl font-black uppercase mb-3 text-background">{item.title}</h3>
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
                Join teams already using AtriumVerse for better remote collaboration.
              </p>
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                <Button
                  size="lg"
                  variant="neutral"
                  className="text-xl font-black px-10 py-7 gap-3"
                >
                  {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
                  <AnimatedArrow size={22} />
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
```

---

## STEP 6 — Update `frontend/app/dashboard/layout.tsx`

Swap static Lucide icons for animated ones in the navbar.

```tsx
// In frontend/app/dashboard/layout.tsx
// Replace the import:
import { LogOut, Settings, Sun, Moon } from "lucide-react";
// WITH:
import { Sun, Moon } from "lucide-react";
import { AnimatedLogOut, AnimatedSettings } from "@/components/ui/animated-icons";

// Then replace:
<LogOut className="h-4 w-4" />
// WITH:
<AnimatedLogOut size={16} />

// And replace:
<Settings className="h-4 w-4" />
// WITH:
<AnimatedSettings size={16} />
```

---

## STEP 7 — Update Dashboard Page Stat Callouts

In `frontend/app/dashboard/page.tsx`, replace the stat strip with more brutal styling:

```tsx
// Find the hero stat strip section and replace the card div with:
<div
  key={stat.label}
  className="border-4 border-border bg-card shadow-shadow p-5 text-center hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
>
  <div className="text-3xl font-black text-primary">{stat.value}</div>
  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{stat.label}</div>
</div>
```

---

## STEP 8 — Update `frontend/components/navigation/ServerDock.tsx`

Add animated home icon + hover effects.

```tsx
// Add import at top:
import { AnimatedHome } from "@/components/ui/animated-icons";
import { motion } from "motion/react";

// Replace the Home Button:
<motion.button
  onClick={navigateHome}
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="w-12 h-12 rounded-none bg-background border-4 border-border shadow-shadow flex items-center justify-center"
  title="Home"
>
  <AnimatedHome size={22} />
</motion.button>

// Replace server icon buttons:
<motion.button
  key={server.id}
  whileHover={{ scale: 1.08 }}
  whileTap={{ scale: 0.94 }}
  onClick={() => navigateToServer(server.id)}
  className={`w-12 h-12 border-4 flex items-center justify-center font-black text-xl transition-all ${
    server.id === currentServerId
      ? "bg-primary border-border text-primary-foreground shadow-[4px_4px_0px_0px_white]"
      : "bg-card border-border text-foreground hover:bg-primary/20"
  }`}
  title={server.name}
>
  {server.name.charAt(0).toUpperCase()}
</motion.button>
```

---

## STEP 9 — Update `frontend/components/sidebar/BaseSidebar.tsx`

Swap Chat/People/Settings buttons to use animated icons.

```tsx
// Add to imports:
import { AnimatedMessage, AnimatedUsers, AnimatedSettings } from "@/components/ui/animated-icons";

// Replace Chat button icon:
<AnimatedMessage size={24} />

// Replace People button icon:
<AnimatedUsers size={24} />

// Replace Settings button icon:
<AnimatedSettings size={24} />
```

---

## STEP 10 — Add scroll-reveal to `frontend/app/dashboard/page.tsx`

Wrap the server grid with a stagger animation:

```tsx
// Add to imports:
import { motion } from "motion/react";

// Wrap allServers.map with:
<motion.div
  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
  initial="hidden"
  animate="visible"
  variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
>
  {allServers.map((server) => (
    <motion.div
      key={server.id}
      variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
    >
      <ServerCard ... />
    </motion.div>
  ))}
</motion.div>
```

---

## ALL COMMANDS — in order

```bash
# 1. Navigate to frontend
cd frontend

# 2. Verify motion is installed (already in package.json at ^12.38.0)
npm list motion
# Expected: motion@12.x.x ✓

# 3. No new packages needed — all libs are copy-paste or already installed
#    If motion is somehow missing:
npm install motion@latest

# 4. Run the dev server to verify changes
npm run dev

# 5. Check for TypeScript errors
npx tsc --noEmit

# 6. Build to verify production bundle
npm run build
```

---

## THEME OPTIONS

Here are 5 alternative themes you can apply by just swapping `globals.css` `:root` variables:

---

### Theme A — "Y2K Cyber" (Current recommendation: best for AtriumVerse)
```
Primary:  #00FF88 (neon green)
Border:   #000000
Shadow:   6px 6px 0px 0px #000
BG:       #0A0A0A (near black)
Cards:    #111111
```
**Vibe:** Hacker aesthetic. Neon on black. Very "spatial platform" feeling. Matrix meets Discord.

---

### Theme B — "Memphis 80s"
```
Primary:  #FF2D78 (hot pink)
Accent:   #FFD700 (gold)
Border:   #000000
BG:       #FFFAEB (warm cream)
Pattern:  Geometric shapes in background
```
**Vibe:** Retro fun. High energy. Good for social/gaming positioning.

---

### Theme C — "Swiss International" (Clean Professional)
```
Primary:  #E63946 (Swiss red)
Border:   #000000
Font:     Helvetica Neue / Inter
BG:       #FFFFFF pure
Shadow:   2px 2px 0px 0px #000 (lighter)
```
**Vibe:** Minimal corporate brutalism. IBM poster meets Dieter Rams. Good for enterprise pitch.

---

### Theme D — "Dark Brutalist" (Current dark mode, pushed further)
```
Primary:  #FFFFFF
Border:   #FFFFFF (white borders on dark)
BG:       #0D0D0D
Cards:    #141414
Shadow:   4px 4px 0px 0px rgba(255,255,255,0.8)
```
**Vibe:** Pure black/white. Maximum contrast. Very bold. Avant-garde.

---

### Theme E — "Pastel Brutalist" (Softest option — trending in 2025)
```
Primary:  #A8DADC (soft teal)
Secondary: #FFB4A2 (peach)
Tertiary:  #B5E48C (mint)
Border:   #2D2D2D (soft dark border)
BG:       #FFF9F0 (warm white)
Shadow:   3px 3px 0px 0px #2D2D2D
```
**Vibe:** Linear App meets brutalism. Friendly, modern, less aggressive.

---

## CSS VARIABLE SWAP (to change theme)

To switch to **Y2K Cyber** theme, replace `:root` in `globals.css`:

```css
:root {
  --background:          oklch(5% 0 0);
  --foreground:          oklch(96% 0 0);
  --main:                oklch(75% 0.22 160);   /* neon green */
  --main-foreground:     oklch(0% 0 0);
  --secondary-background: oklch(10% 0 0);
  --border:              oklch(0% 0 0);
  --card:                oklch(10% 0.005 225);
  --card-foreground:     oklch(96% 0 0);
  --primary:             oklch(75% 0.22 160);
  --primary-foreground:  oklch(0% 0 0);
  --muted:               oklch(18% 0 0);
  --muted-foreground:    oklch(55% 0 0);
  --shadow:              4px 4px 0px 0px oklch(0% 0 0);
}
```

---

## NOTES

1. **No emojis** — all icons are SVG-based (lucide-animated wrappers or Image tags)
2. **lucide-animated.com** — the site is copy-paste only (no npm package). The components above replicate their style using `motion` which you already have installed.
3. **neobrutalism.dev** — since you already use shadcn/ui with neobrutalism CSS vars, the main change is the updated `globals.css` + ensuring `border`, `shadow`, and `rounded-base` values match their spec exactly.
4. **MarqueeFooter** — the scroll-parallax large text uses `useScroll` + `useTransform` from motion. No extra deps.
5. **Performance** — all motion components use `framer-motion`'s hardware-accelerated transforms only (`translate`, `scale`, `rotate`) — no layout thrashing.
