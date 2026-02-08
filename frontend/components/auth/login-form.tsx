"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      if (!response.ok) throw new Error("Login failed");

      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", username);
      localStorage.setItem("user_id", data.user_id);

      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(`Invalid credentials : ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-4 border-border shadow-shadow">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-3xl font-black uppercase tracking-tight">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-base">
          Sign in to your AtriumVerse account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-bold uppercase">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              className="border-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password" className="text-sm font-bold uppercase">
                Password
              </Label>
              <Link
                href="#"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="border-2"
            />
          </div>

          <Button
            disabled={loading}
            type="submit"
            className="w-full font-bold text-base py-6"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
              </>
            ) : (
              <>
                Sign In <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-primary hover:underline"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
