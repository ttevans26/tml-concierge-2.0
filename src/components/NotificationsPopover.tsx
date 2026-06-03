import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  UserPlus,
  UserCheck,
  AlertTriangle,
  CalendarClock,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type NotificationKind =
  | "follow"
  | "request_granted"
  | "travel_warning"
  | "trip_countdown"
  | "cancellation_deadline"
  | string;

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  created_at: string;
  is_read: boolean;
  href?: string;
  trip_id?: string | null;
  item_id?: string | null;
}

const ICONS: Record<string, typeof Bell> = {
  follow: UserPlus,
  request_granted: UserCheck,
  travel_warning: AlertTriangle,
  trip_countdown: CalendarClock,
  cancellation_deadline: CalendarClock,
};

const LABELS: Record<string, string> = {
  follow: "New follower",
  request_granted: "Access granted",
  travel_warning: "Travel alert",
  trip_countdown: "Trip countdown",
  cancellation_deadline: "Cancellation deadline",
};

export default function NotificationsPopover() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unread = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  // Pre-compute relative timestamps once per items change so we don't
  // recompute formatDistanceToNow for every item on every render.
  const itemsView = useMemo(
    () =>
      items.slice(0, 25).map((n) => ({
        ...n,
        timeAgo: formatDistanceToNow(new Date(n.created_at), { addSuffix: true }),
      })),
    [items],
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, created_at, is_read, trip_id, item_id")
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("notifications load failed", error);
      return;
    }
    setItems(
      (data ?? []).map((n) => ({
        ...n,
        href: n.trip_id ? `/trip/${n.trip_id}` : undefined,
      })) as NotificationItem[],
    );
  }, []);

  useEffect(() => {
    // Defer the initial fetch + realtime subscription to idle so it never
    // competes with the page's first-paint or with header click handlers.
    let chan: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const ric: (cb: () => void) => number =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb) => window.setTimeout(cb, 200));
    const handle = ric(() => {
      if (cancelled) return;
      void load();
      (async () => {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid || cancelled) return;
        chan = supabase
          .channel(`notifs:${uid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
            () => void load(),
          )
          .subscribe();
      })();
    });
    return () => {
      cancelled = true;
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (cic) cic(handle);
      else window.clearTimeout(handle);
      if (chan) supabase.removeChannel(chan);
    };
  }, [load]);

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  };

  const dismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").update({ is_dismissed: true }).eq("id", id);
  };

  const handleClick = async (n: NotificationItem) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)));
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
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
            "relative h-9 w-9",
            unread > 0
              ? "text-accent hover:text-accent"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Bell
            className="h-3.5 w-3.5"
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
            {itemsView.map((n) => {
              const Icon = ICONS[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "group flex w-full items-start gap-3 border-b border-foreground/5 px-4 py-3 text-left transition-colors hover:bg-secondary/40 last:border-b-0 cursor-pointer",
                      !n.is_read && "bg-accent/[0.04]",
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
                        {!n.is_read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 font-inter text-[11px] text-muted-foreground line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 font-inter text-[10px] uppercase tracking-widest text-muted-foreground/70">
                        {LABELS[n.kind] ?? n.kind} · {n.timeAgo}
                      </p>
                    </div>
                    <button
                      onClick={(e) => dismiss(n.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}