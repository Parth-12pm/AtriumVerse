"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { Video, Users, Zap, ArrowRight, MessageSquare, Map, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 border-b-4 border-border bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg border-2 border-border shadow-shadow flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-black uppercase tracking-tight">AtriumVerse</span>
          </div>
          
          <nav className="flex items-center gap-4">
            <ModeToggle />
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
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-primary/20 border-2 border-border rounded-lg">
            <span className="text-sm font-bold uppercase tracking-wider">Virtual Collaboration</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight mb-6 leading-tight">
            Virtual Spaces for{" "}
            <span className="text-primary">Real Teams</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Walk around, meet your teammates, and collaborate naturally — just like in a real office, but from anywhere.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="text-lg font-bold px-8 py-6">
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="neutral" className="text-lg font-bold px-8 py-6">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20 border-t-4 border-border">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
            Why AtriumVerse?
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Experience collaboration the way it should be — spontaneous, natural, and engaging.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="bg-primary/10 border-4 border-border">
            <CardHeader>
              <div className="w-14 h-14 bg-primary rounded-lg border-2 border-border shadow-shadow flex items-center justify-center mb-4">
                <Video className="w-7 h-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-black uppercase">Spatial Video</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Video calls that feel natural. Walk up to colleagues to start a conversation, walk away to end it.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-accent/10 border-4 border-border">
            <CardHeader>
              <div className="w-14 h-14 bg-accent rounded-lg border-2 border-border shadow-shadow flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-accent-foreground" />
              </div>
              <CardTitle className="text-2xl font-black uppercase">Team Presence</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                See who's around, who's busy, and who's available. Build team culture remotely.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-secondary border-4 border-border">
            <CardHeader>
              <div className="w-14 h-14 bg-primary rounded-lg border-2 border-border shadow-shadow flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-black uppercase">Instant Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                No more scheduling. Just walk into a meeting room and your video turns on automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20 border-t-4 border-border">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
            How It Works
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full border-4 border-border shadow-shadow flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-black">1</span>
            </div>
            <h3 className="text-xl font-black uppercase mb-2">Create a Space</h3>
            <p className="text-muted-foreground">
              Set up your virtual office in seconds. Choose a template or customize your own.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full border-4 border-border shadow-shadow flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-black">2</span>
            </div>
            <h3 className="text-xl font-black uppercase mb-2">Invite Your Team</h3>
            <p className="text-muted-foreground">
              Share a link and let your teammates join. Everyone gets their own avatar.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full border-4 border-border shadow-shadow flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-black">3</span>
            </div>
            <h3 className="text-xl font-black uppercase mb-2">Start Collaborating</h3>
            <p className="text-muted-foreground">
              Walk around, meet people, join conversations. It's that simple.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 border-t-4 border-border">
        <Card className="bg-primary border-4 border-border p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-primary-foreground mb-4">
            Ready to Transform Your Team?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Join thousands of teams already using AtriumVerse for better remote collaboration.
          </p>
          <Link href="/register">
            <Button size="lg" variant="neutral" className="text-lg font-bold px-8 py-6">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t-4 border-border bg-secondary-background py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg border-2 border-border flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-black uppercase">AtriumVerse</span>
            </div>
            
            <div className="flex gap-8">
              <Link href="/login" className="text-sm font-bold hover:underline">Login</Link>
              <Link href="/register" className="text-sm font-bold hover:underline">Sign Up</Link>
              <Link href="#features" className="text-sm font-bold hover:underline">Features</Link>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © 2026 AtriumVerse. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
