import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  UserPlus,
  UserCheck,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NotificationKind =
  | "follow"
  | "request_granted"
  | "travel_warning"
  | "trip_countdown";

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  href?: string;
}

const ICONS: Record<NotificationKind, typeof Bell> = {
  follow: UserPlus,
  request_granted: UserCheck,
  travel_warning: AlertTriangle,
  trip_countdown: CalendarClock,
};

const LABELS: Record<NotificationKind, string> = {
  follow: "New follower",
  request_granted: "Access granted",
  travel_warning: "Travel alert",
  trip_countdown: "Trip countdown",
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n-1",
    kind: "trip_countdown",
    title: "Tokyo & Kyoto — 7 days out",
    body: "Your trip begins Aug 21. Time to confirm transfers and final dining bookings.",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    read: false,
    href: "/",
  },
  {
    id: "n-2",
    kind: "travel_warning",
    title: "Typhoon advisory — Osaka region",
    body: "Possible weather disruption Aug 23–24. Consider flexible alternatives for Kinosaki day trip.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    read: false,
  },
  {
    id: "n-3",
    kind: "request_granted",
    title: "Eloise Marchand granted access",
    body: "You can now view her shared itineraries.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    read: false,
    href: "/network/user/nu-eloise",
  },
  {
    id: "n-4",
    kind: "follow",
    title: "Saskia Klein started following you",
    body: "View her profile and follow back.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    read: true,
    href: "/network/user/nu-saskia",
  },
];

export default function NotificationsPopover() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markAllRead = () =>
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const handleClick = (n: NotificationItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)),
    );
    if (n.href) {
      setOpen(false);
      navigate(n.href);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
          className={cn(
            "relative h-10 w-10",
            unread > 0
              ? "text-accent hover:text-accent"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Bell
            className="h-4 w-4"
            strokeWidth={unread > 0 ? 2 : 1.5}
            fill={unread > 0 ? "currentColor" : "none"}
          />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-inter text-[9px] font-semibold leading-none text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-2rem))] rounded-sm border-thin border-foreground/15 bg-card p-0"
      >
        <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
          <div>
            <h3 className="font-playfair text-sm font-semibold text-foreground">
              Notifications
            </h3>
            <p className="font-inter text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="font-inter text-[11px] uppercase tracking-widest text-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-inter text-xs text-muted-foreground">
              No notifications yet.
            </p>
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto">
            {items.map((n) => {
              const Icon = ICONS[n.kind];
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-foreground/5 px-4 py-3 text-left transition-colors hover:bg-secondary/40 last:border-b-0",
                      !n.read && "bg-accent/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-thin",
                        n.kind === "travel_warning"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-accent/40 bg-accent/10 text-accent",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-playfair text-[13px] font-semibold text-foreground truncate">
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="mt-0.5 font-inter text-[11px] text-muted-foreground line-clamp-2">
                        {n.body}
                      </p>
                      <p className="mt-1 font-inter text-[10px] uppercase tracking-widest text-muted-foreground/70">
                        {LABELS[n.kind]} ·{" "}
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}