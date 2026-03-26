"use client";

import { Sun, Moon, Settings } from "lucide-react";
import { LogoutIcon } from "@/components/ui/logout";
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
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { CharacterSelectorDropdown } from "@/components/dashboard/character-selector-dropdown";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const username = useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem("username") || "User",
    () => "User",
  );

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
              className="w-56 border-4 border-border bg-card shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-2 rounded-xl"
              align="end"
              sideOffset={8}
            >
              {/* User info header */}
              <div className="flex items-center gap-3 px-2 py-3 mb-2 bg-primary/10 rounded-lg border-2 border-transparent">
                <Avatar className="h-10 w-10 border-2 border-border shadow-sm">
                  <AvatarFallback className="bg-primary text-primary-foreground font-black text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col leading-tight">
                  <p className="text-base font-black truncate max-w-[130px] text-foreground">
                    {mounted ? username : "User"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-border"></span>
                    </span>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Online
                    </span>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator className="border-b-2 border-border/20 my-1" />

              <DropdownMenuItem className="cursor-pointer gap-2 font-bold px-3 py-2.5 focus:bg-primary/20 rounded-md transition-colors">
                <Settings size={16} />
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator className="border-b-2 border-border/20 my-1" />

              <DropdownMenuItem
                className="cursor-pointer font-bold gap-2 px-3 py-2.5 text-red-600 focus:bg-red-100 focus:text-red-700 rounded-md transition-colors"
                onClick={handleLogout}
              >
                <LogoutIcon size={16} />
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
