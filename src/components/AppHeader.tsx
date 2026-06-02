import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, CalendarClock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProfileDrawer from "@/components/ProfileDrawer";
import SchedulingModal from "@/components/SchedulingModal";
import NotificationsPopover from "@/components/NotificationsPopover";
import OfflineIndicator from "@/components/OfflineIndicator";

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
      <header className="sticky top-0 z-40 flex h-[72px] shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:h-24 sm:px-6">
        {/* Left — Brand: Luxury Seal */}
        <button
          onClick={() => navigate("/")}
          className="group shrink-0 border-thin border-accent/60 px-4 py-2 transition-colors hover:border-accent sm:px-5 sm:py-2.5"
        >
          <span className="font-playfair text-xl font-semibold tracking-[0.1em] text-accent sm:text-2xl">
            TML <span className="font-normal italic">Concierge</span>
          </span>
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
                  "relative px-5 py-2 font-playfair text-base transition-colors sm:px-6 sm:text-lg",
                  active
                    ? "bg-accent/10 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-[2px] bg-accent" />
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
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarClock className="h-3 w-3 text-accent" strokeWidth={1.5} />
            Plan w/ Concierge
          </Button>

          <NotificationsPopover />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setProfileOpen(true)}
          >
            <User className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </header>

      <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} />
      <SchedulingModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </>
  );
}
