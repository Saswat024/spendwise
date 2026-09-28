import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Moon,
  Sun,
  Target,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { clearAuth, getStoredUser } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/budgets", label: "Budgets", icon: Target },
  { to: "/chat", label: "Assistant", icon: MessageSquareText },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = getStoredUser();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("spendwise_theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("spendwise_theme", next ? "dark" : "light");
  }

  function logout() {
    clearAuth();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-3 sm:px-4">
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-foreground shrink-0">
            <img src="/favicon.png" alt="SpendWise" className="h-8 w-8 rounded-lg object-contain shadow-xs" />
            <span className="text-base sm:text-lg font-bold tracking-tight">SpendWise</span>
          </Link>
          <nav className="hidden sm:flex flex-1 items-center gap-1 ml-2">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === to && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline mr-2">{user?.name}</span>
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={logout}
              aria-label="Log out"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area (with bottom padding for mobile navigation) */}
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-5 sm:py-8 pb-24 sm:pb-8">{children}</main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md px-2 py-1.5 shadow-lg">
        <div className="grid grid-cols-4 gap-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const isActive = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate max-w-full">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
