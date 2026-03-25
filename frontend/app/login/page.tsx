"use client";

import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";

const decorativeWords = [
  "SECURE",
  "SPATIAL",
  "ENCRYPTED",
  "COLLABORATIVE",
  "VIRTUAL",
  "REAL-TIME",
  "PRIVATE",
  "LIVE",
];

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b-4 border-border bg-background">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ rotate: 12 }}
              transition={{ type: "spring", stiffness: 400 }}
              className="w-10 h-10 bg-primary border-2 border-border shadow-shadow flex items-center justify-center"
            >
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </motion.div>
            <span className="text-xl font-black uppercase tracking-tight">
              AtriumVerse
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* Left panel — decorative */}
        <motion.div
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-col bg-primary border-r-4 border-border relative overflow-hidden"
        >
          {/* Background image */}
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=75"
              alt="Office collaboration"
              fill
              className="object-cover opacity-20"
            />
          </div>

          {/* Animated keyword grid */}
          <div className="relative flex-1 flex flex-col items-center justify-center p-12 gap-8">
            <div className="flex flex-wrap gap-3 justify-center max-w-md">
              {decorativeWords.map((word, i) => (
                <motion.div
                  key={word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.5 }}
                  className="px-4 py-2 border-2 border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground font-black text-xs uppercase tracking-widest"
                >
                  {word}
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="text-4xl font-black uppercase text-primary-foreground leading-tight"
              >
                Walk In,
                <br />
                Talk Live,
                <br />
                Work Together.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="text-primary-foreground/70 mt-4 font-medium"
              >
                Your virtual office awaits.
              </motion.p>
            </div>

          </div>
        </motion.div>

        {/* Right panel — form */}
        <motion.div
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center p-6 md:p-12"
        >
          <div className="w-full max-w-md">
            <LoginForm />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
