import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  Gauge,
  History,
  Link2,
  LogOut,
  Menu,
  Moon,
  ScanSearch,
  Settings,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/scanner", label: "Email Scanner", icon: ScanSearch },
  { to: "/url-analysis", label: "URL Analysis", icon: Link2 },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/history", label: "Scan History", icon: History },
  { to: "/activity", label: "Activity Log", icon: Activity },
] as const;

const ACCOUNT = [
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const NavList = () => (
    <nav className="flex flex-1 flex-col gap-6 px-3">
      <div className="space-y-1">
        <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Operations
        </p>
        {NAV.map((item) => (
          <SideLink key={item.to} {...item} active={pathname === item.to} onNavigate={() => setMobileOpen(false)} />
        ))}
      </div>
      <div className="space-y-1">
        <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Account
        </p>
        {ACCOUNT.map((item) => (
          <SideLink key={item.to} {...item} active={pathname === item.to} onNavigate={() => setMobileOpen(false)} />
        ))}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar/80 py-5 backdrop-blur-xl lg:flex">
        <div className="px-5 pb-6">
          <Link to="/dashboard">
            <Logo />
          </Link>
        </div>
        <NavList />
        <div className="mt-auto px-3 pt-4">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar py-5 shadow-2xl">
            <div className="flex items-center justify-between px-5 pb-6">
              <Logo />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
            <NavList />
            <div className="mt-auto px-3 pt-4">
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-border/70 bg-background/75 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
            {description && (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SideLink({
  to,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-primary/12 text-primary shadow-[inset_2px_0_0_0_var(--primary)]"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
