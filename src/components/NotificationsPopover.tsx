import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  UserPlus,
  UserCheck,
  AlertTriangle,
  CalendarClock,
  X,
  KeyRound,
  Check,
  Loader2,
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
import {
  notifications as notificationsService,
  tripAccessRequests as accessRequestsService,
  ServiceError,
} from "@/services";
import type { PendingAccessRequest } from "@/services/tripAccessRequests";
import { toast } from "sonner";

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
  const [accessRequests, setAccessRequests] = useState<PendingAccessRequest[]>([]);
  const [accessActioning, setAccessActioning] = useState<string | null>(null);

  const unread = useMemo(
    () => items.filter((n) => !n.is_read).length + accessRequests.length,
    [items, accessRequests.length],
  );

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
    try {
      const data = await notificationsService.listActive(50);
      setItems(
        data.map((n) => ({
          ...n,
          href: n.trip_id ? `/trip/${n.trip_id}` : undefined,
        })) as NotificationItem[],
      );
    } catch (err) {
      console.warn("notifications load failed", err instanceof ServiceError ? err.message : err);
    }
    try {
      const reqs = await accessRequestsService.listPendingForOwner();
      setAccessRequests(reqs);
    } catch (err) {
      console.warn("access requests load failed", err instanceof ServiceError ? err.message : err);
    }
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
    await notificationsService.markRead(ids).catch((e) => console.warn("markRead", e));
  };

  const dismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.id !== id));
    await notificationsService.dismiss(id).catch((e) => console.warn("dismiss", e));
  };

  const handleClick = async (n: NotificationItem) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)));
      await notificationsService.markOneRead(n.id).catch((e) => console.warn("markOneRead", e));
    }
    if (n.href) {
      setOpen(false);
      navigate(n.href);
    }
  };

  const respondAccess = async (id: string, action: "approve" | "deny") => {
    setAccessActioning(id);
    try {
      if (action === "approve") await accessRequestsService.approveRequest(id);
      else await accessRequestsService.denyRequest(id);
      setAccessRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success(action === "approve" ? "Access approved" : "Request denied");
    } catch (err) {
      toast.error("Could not update request");
      console.warn("respondAccess", err);
    } finally {
      setAccessActioning(null);
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

        {accessRequests.length > 0 && (
          <div className="border-b border-foreground/10 bg-accent/[0.04]">
            <p className="px-4 pt-3 font-inter text-[10px] font-semibold uppercase tracking-widest text-accent">
              Pending access requests
            </p>
            <ul>
              {accessRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-foreground/5 last:border-b-0"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-thin border-accent/40 bg-accent/10 text-accent">
                    <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-playfair text-[13px] font-semibold text-foreground truncate">
                      Access requested
                    </p>
                    {r.trip_name && (
                      <p className="font-inter text-[11px] text-foreground truncate">
                        {r.trip_name}
                      </p>
                    )}
                    {r.message && (
                      <p className="mt-0.5 font-inter text-[11px] text-muted-foreground line-clamp-2 italic">
                        “{r.message}”
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={accessActioning === r.id}
                        onClick={() => respondAccess(r.id, "approve")}
                        className="h-7 gap-1 rounded-[2px] font-inter text-[10px] tap-target"
                      >
                        {accessActioning === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={accessActioning === r.id}
                        onClick={() => respondAccess(r.id, "deny")}
                        className="h-7 rounded-[2px] font-inter text-[10px] text-muted-foreground hover:text-destructive tap-target"
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.length === 0 && accessRequests.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-inter text-xs text-muted-foreground">
              No notifications yet.
            </p>
          </div>
        ) : items.length === 0 ? null : (
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