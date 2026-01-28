import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Search, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-blue-50 dark:bg-zinc-950">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* TOP BAR */}
          <header className="h-16 border-b bg-background flex items-center justify-between px-6 sticky top-0 z-10 w-full">
            <div className="flex items-center gap-4">
              <SidebarTrigger /> 
              <div className="relative hidden md:flex items-center">
                 <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
                 <Input 
                   placeholder="Search here" 
                   className="pl-10 w-[300px]" 
                 />
              </div>
            </div>

            <div className="flex items-center gap-4">
                <ModeToggle />
                <Button size="icon" className="rounded-full">
                    <User className="w-5 h-5" />
                </Button>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}