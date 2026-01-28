"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner"; 

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

      const response = await fetch("http://localhost:8000/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      if (!response.ok) throw new Error("Login failed");

      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", username);

      toast.success("Welcome back!");
      router.push("/dashboard"); 
      
    } catch (error) {
      toast.error("Invalid credentials");
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card className="w-[450px] h-[450px]"> {/* Clean card */}
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Atrium-Verse</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-bold">Username</label>
            <Input 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Enter username"
            />
          </div>
          <div className="space-y-4">
            <label className="text-sm font-bold">Password</label>
            <Input 
              type="password"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="*********"
            />
          </div>
          <div className="b-10">
            <Button disabled={loading} type="submit" className="w-full">
            {loading ? "Loading..." : "Login"}
          </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}