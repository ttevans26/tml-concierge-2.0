import type { Waypoint } from "@/lib/tripRoute";

const STORAGE_KEY = "tml-route-cache-v1";

export interface RouteCacheEntry {
  waypoints: Waypoint[];
  signature: string;
  updatedAt: number;
}

type ItemForSignature = {
  id: string;
  date?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  category?: string | null;
  sort_order?: number | null;
};

/** Stable, cheap, non-cryptographic hash. Good enough for cache invalidation. */
function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function computeRouteSignature(
  tripUpdatedAt: string | null | undefined,
  items: ItemForSignature[],
): string {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const payload = sorted
    .map(
      (i) =>
        `${i.id}|${i.date ?? ""}|${i.location_lat ?? ""}|${i.location_lng ?? ""}|${i.category ?? ""}|${i.sort_order ?? ""}`,
    )
    .join("~");
  return hashString(`${tripUpdatedAt ?? ""}::${payload}`);
}

function readAll(): Record<string, RouteCacheEntry> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, RouteCacheEntry>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, RouteCacheEntry>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota or serialization issues — silently ignore; cache is best-effort.
  }
}

export function getCachedRoute(tripId: string): RouteCacheEntry | null {
  const map = readAll();
  return map[tripId] ?? null;
}

export function setCachedRoute(tripId: string, entry: RouteCacheEntry) {
  const map = readAll();
  map[tripId] = entry;
  writeAll(map);
}

export function invalidateCachedRoute(tripId: string) {
  const map = readAll();
  if (map[tripId]) {
    delete map[tripId];
    writeAll(map);
  }
}