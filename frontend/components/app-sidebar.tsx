"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { 
  Calendar, 
  Home, 
  Video, 
  Settings, 
  Sparkles,
  Users,
  MessageSquare,
  HelpCircle
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"

// Main navigation items
const mainItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    description: "Overview & Stats",
  },
  {
    title: "Calendar",
    url: "#",
    icon: Calendar,
    description: "Coming soon",
    disabled: true,
  },
]

// Secondary navigation items
const secondaryItems = [
  {
    title: "Team",
    url: "#",
    icon: Users,
    description: "Manage members",
    disabled: true,
  },
  {
    title: "Messages",
    url: "#",
    icon: MessageSquare,
    description: "Coming soon",
    disabled: true,
  },
]

// Footer items
const footerItems = [
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
  {
    title: "Help",
    url: "#",
    icon: HelpCircle,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r-4 border-border">
      {/* Header with Logo */}
      <SidebarHeader className="p-4 border-b-4 border-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg border-2 border-border shadow-shadow flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <span className="text-xl font-black uppercase tracking-tight">AtriumVerse</span>
            <p className="text-xs text-muted-foreground font-bold">Virtual Workspace</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold uppercase text-muted-foreground px-2 mb-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      className={`
                        rounded-lg border-2 mb-1 transition-all h-10
                        ${isActive 
                          ? 'bg-primary text-primary-foreground border-border shadow-shadow' 
                          : 'border-transparent hover:border-border hover:bg-primary/10'
                        }
                        ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <Link 
                        href={item.disabled ? "#" : item.url}
                        onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                        className="flex items-center gap-2 w-full"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-bold">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="my-4 border-t-4 border-border" />

        {/* Secondary Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold uppercase text-muted-foreground px-2 mb-2">
            Collaborate
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      className={`
                        rounded-lg border-2 mb-1 transition-all h-10
                        ${isActive 
                          ? 'bg-primary text-primary-foreground border-border shadow-shadow' 
                          : 'border-transparent hover:border-border hover:bg-primary/10'
                        }
                        ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <Link 
                        href={item.disabled ? "#" : item.url}
                        onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                        className="flex items-center gap-2 w-full"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-bold">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-2 border-t-4 border-border">
        <SidebarMenu>
          {footerItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton 
                asChild 
                className="rounded-lg border-2 border-transparent hover:border-border hover:bg-primary/10 transition-all h-10"
              >
                <Link href={item.url} className="flex items-center gap-2 w-full">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="font-bold">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
