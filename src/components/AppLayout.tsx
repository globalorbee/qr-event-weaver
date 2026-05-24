import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calendar, Users, Settings, QrCode, LogOut, ScanLine } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentEvent } from "@/stores/use-current-event";

const items = [
  { title: "Events", url: "/dashboard", icon: Calendar },
  { title: "Attendees", url: "/attendees", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = useCurrentEvent((s) => s.current);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <QrCode className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">Passly</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={path === it.url || path.startsWith(it.url + "/")}>
                    <Link to={it.url}>
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {current && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/gatekeeper/")}>
                    <Link to="/gatekeeper/$eventId" params={{ eventId: current.id }}>
                      <ScanLine className="h-4 w-4" />
                      <span>Gatekeeper</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {current && (
          <SidebarGroup>
            <SidebarGroupContent className="px-2">
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs group-data-[collapsible=icon]:hidden">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Current event</div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: current.brand_color }} />
                  <span className="truncate font-medium">{current.name}</span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-1 px-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            {title && <h1 className="font-display text-sm font-medium tracking-tight">{title}</h1>}
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}