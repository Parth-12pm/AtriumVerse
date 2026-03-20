"use client";

import { useRef } from "react";

export function MarqueeFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const year = new Date().getFullYear();

  return (
    <footer ref={ref} className="relative overflow-hidden border-t-4 border-border bg-background">
      {/* Huge centered brand name */}
      <div className="overflow-hidden py-12 select-none flex justify-center items-center w-full">
        <span
          className="text-[clamp(40px,10vw,160px)] font-black uppercase tracking-tight leading-none text-foreground/10 select-none text-center"
          style={{ WebkitTextStroke: "2px hsl(var(--border) / 0.3)" }}
        >
          AtriumVerse
        </span>
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
              <p className="text-xs text-background/60 font-medium">Walk in, Talk live, Work together.</p>
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
