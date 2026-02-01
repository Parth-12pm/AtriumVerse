"use client";

import { RegisterForm } from "@/components/auth/register-form";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple Header */}
      <header className="border-b-4 border-border bg-background">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg border-2 border-border shadow-shadow flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-black uppercase tracking-tight">AtriumVerse</span>
          </Link>
        </div>
      </header>

      {/* Register Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <RegisterForm />
      </main>
    </div>
  );
}
