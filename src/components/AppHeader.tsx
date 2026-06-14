import { lazy, Suspense, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, CalendarClock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import NotificationsPopover from "@/components/NotificationsPopover";
import OfflineIndicator from "@/components/OfflineIndicator";
import { useAuth } from "@/hooks/useAuth";

// Heavy: react-day-picker (≈106KB) + many shadcn primitives.
// Lazy-loaded + only mounted after first open so the header click
// handlers stay snappy (~200ms INP otherwise on first click).
const ProfileDrawer = lazy(() => import("@/components/ProfileDrawer"));
const SchedulingModal = lazy(() => import("@/components/SchedulingModal"));

/**
 * Prefetch maps each nav path to the dynamic `import()` of its lazy route
 * chunk. Calling it on hover/focus warms the browser cache so the click
 * itself has zero network latency.
 */
const prefetchers: Record<string, () => Promise<unknown>> = {
  "/studio": () => import("@/pages/Studio"),
  "/tools": () => import("@/pages/Tools"),
  "/today": () => import("@/pages/Today"),
  "/network": () => import("@/pages/Network"),
};
const prefetched = new Set<string>();
const prefetch = (path: string) => {
  if (prefetched.has(path)) return;
  const fn = prefetchers[path];
  if (!fn) return;
  prefetched.add(path);
  void fn().catch(() => prefetched.delete(path));
};

const navItems = [
  { label: "Trips", path: "/" },
  { label: "Studio", path: "/studio" },
  { label: "Tools", path: "/tools" },
];

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Track whether each lazy bundle has ever been requested so we keep it
  // mounted (preserving state) once it loads, but never mount before first use.
  const [profileMounted, setProfileMounted] = useState(false);
  const [scheduleMounted, setScheduleMounted] = useState(false);

  const openSchedule = () => {
    setScheduleMounted(true);
    setScheduleOpen(true);
  };
  const openProfile = () => {
    setProfileMounted(true);
    setProfileOpen(true);
  };

  const email = user?.email ?? "";
  const emailShort = email ? email.split("@")[0] : "";

  return (
    <>
      <header className="sticky top-0 z-40 flex h-[72px] shrink-0 items-center justify-between border-b border-foil bg-surface-1/85 px-4 backdrop-blur-md sm:h-24 sm:px-8">
        {/* Left — Brand: Luxury Seal */}
        <button
          onClick={() => navigate("/")}
          className="group relative shrink-0 px-2 py-2 transition-all duration-quick ease-editorial sm:px-3 sm:py-2.5"
        >
          <span className="font-playfair text-2xl font-bold tracking-[0.04em] text-ink sm:text-[28px]">
            TML
            <span className="ml-1.5 italic-accent text-accent font-medium">Concierge</span>
          </span>
          <span className="pointer-events-none absolute -bottom-0.5 left-2 right-2 h-px scale-x-0 origin-left bg-foil transition-transform duration-soft ease-editorial group-hover:scale-x-100" />
        </button>

        {/* Center — Nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => prefetch(item.path)}
                onFocus={() => prefetch(item.path)}
                className={cn(
                  "relative px-5 py-2 font-playfair text-base transition-colors duration-quick ease-editorial sm:px-6 sm:text-[17px]",
                  active
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground font-medium",
                )}
              >
                <span className={cn(active && "italic-accent text-accent font-semibold")}>{item.label}</span>
                {active && (
                  <span className="absolute inset-x-4 -bottom-1 h-[2px] bg-foil" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right — Actions */}
        <div className="flex items-center gap-1.5">
          <OfflineIndicator />
          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-1.5 font-inter text-xs text-muted-foreground hover:text-accent md:inline-flex"
            onClick={() => navigate("/network")}
            onMouseEnter={() => prefetch("/network")}
            onFocus={() => prefetch("/network")}
          >
            <Users className="h-3 w-3 text-accent" strokeWidth={1.5} />
            Travel Network
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Travel Network"
            className="h-9 w-9 text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => navigate("/network")}
          >
            <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-1.5 font-inter text-xs text-muted-foreground hover:text-foreground md:inline-flex"
            onClick={openSchedule}
          >
            <CalendarClock className="h-3 w-3 text-accent" strokeWidth={1.5} />
            Plan w/ Concierge
          </Button>

          <NotificationsPopover />

          {email && (
            <button
              type="button"
              onClick={openProfile}
              title={email}
              aria-label={`Signed in as ${email}`}
              className="hidden h-9 items-center rounded-[2px] border border-foil/60 px-2.5 font-inter text-[11px] tracking-wide text-muted-foreground transition-colors duration-quick ease-editorial hover:border-accent/60 hover:text-foreground sm:inline-flex"
            >
              <span className="max-w-[160px] truncate">{email}</span>
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={openProfile}
            aria-label={email ? `Account · ${emailShort}` : "Account"}
          >
            <User className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </header>

      <Suspense fallback={null}>
        {profileMounted && (
          <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} />
        )}
        {scheduleMounted && (
          <SchedulingModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
        )}
      </Suspense>
    </>
  );
}
