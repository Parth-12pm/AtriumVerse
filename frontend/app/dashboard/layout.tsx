"use client";

import { LogOut, Settings, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { CharacterSelectorDropdown } from "@/components/dashboard/character-selector-dropdown";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("User");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setUsername(localStorage.getItem("username") || "User");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("user_id");
    router.push("/login");
  };

  const initials = mounted ? username.slice(0, 2).toUpperCase() : "US";
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── NAVBAR ── */}
      <header className="h-14 border-b-4 border-border bg-card sticky top-0 z-50 flex items-center p-8 px-8 gap-4">
        {/* LEFT — character selector */}
        {mounted && <CharacterSelectorDropdown />}

        {/* CENTER — brand */}
        <div className="flex-1 flex justify-center pointer-events-none select-none">
          <span className="font-black text-base uppercase tracking-[0.2em]">
            AtriumVerse
          </span>
        </div>

        {/* RIGHT — theme toggle (round) + avatar dropdown (round) */}
        <div className="flex items-center gap-2">
          {/* Theme toggle — circle, same size as avatar */}
          {mounted && (
            <Button
              variant="neutral"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="h-9 w-9 rounded-full border-2 border-border p-0 flex items-center justify-center"
              title={isDark ? "Switch to light" : "Switch to dark"}
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="neutral"
                className="h-9 w-9 rounded-full border-2 border-border p-0"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs rounded-full">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-52 border-2 border-border"
              align="end"
              sideOffset={8}
            >
              {/* User info header */}
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground font-black text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col leading-tight">
                  <p className="text-sm font-bold truncate max-w-[130px]">
                    {mounted ? username : "User"}
                  </p>
                  <p className="text-xs text-muted-foreground">● Online</p>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem className="cursor-pointer gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive gap-2"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── PAGE CONTENT ── */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
