import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, User, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProfileDrawer from "@/components/ProfileDrawer";
import SchedulingModal from "@/components/SchedulingModal";

const navItems = [
  { label: "Trips", path: "/" },
  { label: "Studio", path: "/studio" },
  { label: "Tools", path: "/tools" },
];

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-sm">
        {/* Left — Brand */}
        <button
          onClick={() => navigate("/")}
          className="font-playfair text-base font-semibold tracking-tight text-foreground"
        >
          TML Concierge
        </button>

        {/* Center — Nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={cn(
                  "rounded-sm px-3 py-1.5 font-inter text-xs font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right — Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-1.5 font-inter text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
            onClick={() => setScheduleOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            Plan w/ Concierge
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setProfileOpen(true)}
          >
            <User className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </header>

      <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} />
      <SchedulingModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </>
  );
}
