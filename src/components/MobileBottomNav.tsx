import { useLocation, useNavigate } from "react-router-dom";
import { Home, Map, FolderHeart, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/useTripStore";

const items = [
  { label: "Today", path: "/today", icon: Home },
  { label: "Trips", path: "/", icon: Map },
  { label: "Studio", path: "/studio", icon: FolderHeart },
  { label: "Tools", path: "/tools", icon: Wrench },
];

/** Warm lazy-route chunks on tap-start so the navigation feels instant. */
const prefetchers: Record<string, () => Promise<unknown>> = {
  "/studio": () => import("@/pages/Studio"),
  "/tools": () => import("@/pages/Tools"),
  "/today": () => import("@/pages/Today"),
};
const prefetched = new Set<string>();
const prefetch = (path: string) => {
  if (prefetched.has(path)) return;
  const fn = prefetchers[path];
  if (!fn) return;
  prefetched.add(path);
  void fn().catch(() => prefetched.delete(path));
};

/**
 * Native-style bottom tab bar shown only on mobile widths. Honors iOS
 * safe-area so it sits above the home indicator.
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTrip = useTripStore((s) => s.activeTrip);

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-sm sm:hidden"
      aria-label="Primary"
    >
      {items.map((it) => {
        const isHome = it.path === "/";
        const active = isHome
          ? location.pathname === "/" || location.pathname.startsWith("/trip/")
          : location.pathname.startsWith(it.path);
        const Icon = it.icon;
        return (
          <button
            key={it.path}
            type="button"
            onTouchStart={() => prefetch(it.path)}
            onMouseEnter={() => prefetch(it.path)}
            onClick={() => {
              if (it.path === "/" && activeTrip?.id && location.pathname === "/") {
                navigate(`/trip/${activeTrip.id}`);
              } else {
                navigate(it.path);
              }
            }}
            className={cn(
              "flex h-14 min-h-[44px] flex-col items-center justify-center gap-0.5 font-inter text-[10px] tracking-wide transition-colors",
              active ? "text-accent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className={cn("h-[18px] w-[18px]", active && "stroke-[1.75]")}
              strokeWidth={1.5}
            />
            <span className="leading-none">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}