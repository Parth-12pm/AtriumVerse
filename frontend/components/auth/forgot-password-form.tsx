"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ArrowLeft, Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const urlUsername = searchParams.get("username");
        if (urlUsername) {
            setUsername(urlUsername);
        }
    }, [searchParams]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            const API_URL =
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const response = await fetch(`${API_URL}/users/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, old_password: oldPassword, new_password: newPassword }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Reset failed");
            }

            // Auto-login after successful reset
            const formData = new URLSearchParams();
            formData.append("username", username);
            formData.append("password", newPassword);

            const login_response = await fetch(`${API_URL}/users/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData,
            });

            if (!login_response.ok) {
                toast.success("Password reset successful! Please login.");
                router.push("/login");
                return;
            }

            const login_data = await login_response.json();
            localStorage.setItem("token", login_data.access_token);
            localStorage.setItem("username", username);
            localStorage.setItem("user_id", login_data.user_id);

            toast.success("Password reset & logged in!");
            router.push("/dashboard");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Reset failed",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md border-4 border-border shadow-shadow">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-3xl font-black uppercase tracking-tight">
                    Reset Password
                </CardTitle>
                <CardDescription className="text-base">
                    Enter your username and your new password
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="username" className="text-sm font-bold uppercase">
                            Username
                        </Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            className="border-2"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="oldPassword" className="text-sm font-bold uppercase">
                            Old Password
                        </Label>
                        <Input
                            id="oldPassword"
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="border-2"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newPassword" className="text-sm font-bold uppercase">
                            New Password
                        </Label>
                        <Input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="border-2"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-bold uppercase">
                            Confirm Password
                        </Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...
                            </>
                        ) : (
                            "Reset Password"
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        Remember your password?{" "}
                        <Link
                            href="/login"
                            className="font-bold text-primary hover:underline inline-flex items-center"
                        >
                            <ArrowLeft className="mr-1 h-3 w-3" /> Back to login
                        </Link>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
