import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import {
  Menu, Search, X, Share2, Hotel, UtensilsCrossed, Compass, Landmark,
  MapPin, Star, Loader2, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStudioStore, StudioCategory, StudioItem, StudioFolder } from "@/stores/useStudioStore";
import { useGooglePlaces } from "@/hooks/useGooglePlaces";
import { classifyPlace, CATEGORY_LABEL } from "@/lib/placeCategory";
import { toast } from "sonner";
import StudioMap from "./StudioMap";
import FolderSwitcherDrawer from "./FolderSwitcherDrawer";
import PasteSocialDialog from "./PasteSocialDialog";

const CAT_META: Record<StudioCategory, { label: string; icon: any; color: string }> = {
  stays: { label: "Stays", icon: Hotel, color: "hsl(var(--cell-stays))" },
  dining: { label: "Dining", icon: UtensilsCrossed, color: "hsl(var(--cell-dining))" },
  activity: { label: "Activities", icon: Compass, color: "hsl(var(--cell-activity))" },
  sites: { label: "Sites of Interest", icon: Landmark, color: "hsl(var(--cell-sites))" },
};

const CAT_ORDER: StudioCategory[] = ["stays", "dining", "activity", "sites"];

function getCoords(item: StudioItem): { lat: number; lng: number } | null {
  if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
  const meta = (item.api_metadata || {}) as any;
  const mLat = Number(meta.lat ?? meta.location_lat);
  const mLng = Number(meta.lng ?? meta.location_lng);
  if (!isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0) return { lat: mLat, lng: mLng };
  return null;
}

function getPhotos(item: StudioItem): string[] {
  const meta = (item.api_metadata || {}) as any;
  const photos: string[] = [];
  if (typeof meta.photo_url === "string") photos.push(meta.photo_url);
  if (Array.isArray(meta.photo_urls)) {
    for (const p of meta.photo_urls) if (typeof p === "string" && !photos.includes(p)) photos.push(p);
  }
  return photos;
}

/* -------------------- Search overlay -------------------- */

function SearchOverlay({
  activeFolder,
  onOpenFolders,
  onOpenSocial,
}: {
  activeFolder: StudioFolder | null;
  onOpenFolders: () => void;
  onOpenSocial: () => void;
}) {
  const { addItem } = useStudioStore();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [adding, setAdding] = useState(false);
  const {
    predictions,
    search,
    getDetails,
  } = useGooglePlaces({ types: ["establishment"], enabled: !!activeFolder });

  useEffect(() => {
    if (!query.trim()) {
      setShowResults(false);
      return;
    }
    const hint = activeFolder?.location ? `, ${activeFolder.location}` : "";
    const t = setTimeout(() => {
      search(`${query}${hint}`);
      setShowResults(true);
    }, 250);
    return () => clearTimeout(t);
  }, [query, activeFolder?.location, search]);

  const handlePick = async (p: typeof predictions[number]) => {
    if (!activeFolder) {
      toast.info("Open a collection first to save places.");
      return;
    }
    setAdding(true);
    setShowResults(false);
    try {
      const dup = activeFolder.items.find((i) => i.google_place_id === p.place_id);
      if (dup) {
        toast.info(`"${dup.title}" is already in ${activeFolder.name}.`);
        return;
      }
      const details = await getDetails(p.place_id);
      const category = classifyPlace(details?.types ?? []);
      const title = details?.name || p.structured_formatting.main_text;
      await addItem(activeFolder.id, {
        category,
        title,
        description: null,
        address: details?.address || p.structured_formatting.secondary_text || null,
        url: details?.website ?? null,
        lat: details?.lat ?? null,
        lng: details?.lng ?? null,
        cost: null,
        google_place_id: details?.placeId || p.place_id,
        source_url: null,
        api_metadata: details
          ? {
              lat: details.lat,
              lng: details.lng,
              phone: details.phone,
              rating: details.rating,
              user_ratings_total: details.userRatingsTotal,
              photo_url: details.photoUrl,
              hours: details.hours,
              types: details.types,
            }
          : {},
      });
      toast.success(`Added "${title}" — ${CATEGORY_LABEL[category]}.`);
      setQuery("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not add place.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-paper backdrop-blur">
        <button
          type="button"
          onClick={onOpenFolders}
          aria-label="Open collections"
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Menu className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => predictions.length > 0 && setShowResults(true)}
            placeholder={activeFolder ? "Find a place" : "Open a collection to search"}
            disabled={!activeFolder || adding}
            className="h-9 rounded-full border-0 bg-transparent pl-7 pr-8 font-inter text-[13px] focus-visible:ring-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setShowResults(false); }}
              aria-label="Clear"
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenSocial}
          aria-label="Paste social link"
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Share2 className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {showResults && predictions.length > 0 && (
        <div className="pointer-events-auto mt-2 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-raised">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => handlePick(p)}
              className="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-secondary"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-inter text-[13px] font-medium text-foreground">
                  {p.structured_formatting.main_text}
                </div>
                <div className="truncate font-inter text-[11px] text-muted-foreground">
                  {p.structured_formatting.secondary_text}
                </div>
              </div>
              <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- Place row (sheet content) -------------------- */

function PlaceRow({
  item,
  onSelect,
}: {
  item: StudioItem;
  onSelect: () => void;
}) {
  const meta = (item.api_metadata || {}) as any;
  const rating: number | null = typeof meta.rating === "number" ? meta.rating : null;
  const reviews: number | null = typeof meta.user_ratings_total === "number" ? meta.user_ratings_total : null;
  const Icon = CAT_META[item.category].icon;
  const color = CAT_META[item.category].color;
  const photos = getPhotos(item);

  return (
    <div className="border-b border-border px-4 py-4">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ background: color, color: "#fff" }}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-playfair text-[15px] font-semibold leading-snug text-foreground">
            {item.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-inter text-[11px] text-muted-foreground">
            {rating != null && (
              <span className="flex items-center gap-0.5 text-foreground">
                {rating.toFixed(1)}
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {reviews != null && <span className="text-muted-foreground">({reviews})</span>}
              </span>
            )}
            <span>· {CATEGORY_LABEL[item.category]}</span>
            {item.address && <span className="truncate">· {item.address}</span>}
          </div>
        </div>
      </button>

      {photos.length > 0 && (
        <div className="mt-3 -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none">
          {photos.map((src, idx) => (
            <img
              key={`${src}-${idx}`}
              src={src}
              alt=""
              loading="lazy"
              className="h-28 w-36 shrink-0 rounded-md object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- Vault picker (no-folder state) -------------------- */

function VaultPicker({ onPick }: { onPick: () => void }) {
  const { folders, setActiveFolder } = useStudioStore();
  if (folders.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="font-playfair italic-accent text-base text-foreground">
          Your atlas awaits
        </p>
        <p className="mx-auto mt-2 max-w-xs font-inter text-[12px] leading-relaxed text-muted-foreground">
          Tap the menu to create your first collection — then start pinning places.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="px-5 pt-3 font-inter text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Open a collection
      </p>
      <div className="mt-2">
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setActiveFolder(f); onPick(); }}
            className="flex w-full items-center justify-between border-b border-border px-5 py-3 text-left hover:bg-secondary"
          >
            <div className="min-w-0">
              <div className="truncate font-playfair text-sm text-foreground">{f.name}</div>
              <div className="truncate font-inter text-[11px] text-muted-foreground">
                {f.location} · {f.items.length} items
              </div>
            </div>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Main mobile view -------------------- */

export default function StudioMobileView() {
  const activeFolder = useStudioStore((s) => s.activeFolder);
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  // Snap points are CSS lengths in vaul. Two-stop peek + expanded.
  const snapPoints = useMemo(() => [0.32, 0.85], []);
  const [snap, setSnap] = useState<number | string | null>(snapPoints[0]);

  const grouped = useMemo(() => {
    if (!activeFolder) return [] as Array<{ key: StudioCategory; items: StudioItem[] }>;
    return CAT_ORDER.map((k) => ({
      key: k,
      items: activeFolder.items.filter((i) => i.category === k),
    })).filter((g) => g.items.length > 0);
  }, [activeFolder]);

  const totalItems = activeFolder?.items.length ?? 0;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-card">
      {/* Map fills the surface */}
      <div className="absolute inset-0">
        <StudioMap bare focusItemId={focusItemId} onSelectItem={(it) => setFocusItemId(it.id)} />
      </div>

      {/* Top search overlay */}
      <SearchOverlay
        activeFolder={activeFolder}
        onOpenFolders={() => setFolderDrawerOpen(true)}
        onOpenSocial={() => setSocialOpen(true)}
      />

      {/* Bottom sheet — always open, snappable */}
      <DrawerPrimitive.Root
        open
        modal={false}
        dismissible={false}
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Content
            className="fixed inset-x-0 bottom-0 z-40 flex h-full max-h-[92dvh] flex-col rounded-t-[14px] border-t border-border bg-background shadow-raised"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
            <div className="flex items-center justify-between px-5 pb-2 pt-2">
              <div className="min-w-0">
                <DrawerPrimitive.Title className="truncate font-playfair text-[15px] font-semibold text-foreground">
                  {activeFolder ? activeFolder.name : "Saved places"}
                </DrawerPrimitive.Title>
                <DrawerPrimitive.Description className="truncate font-inter text-[11px] text-muted-foreground">
                  {activeFolder
                    ? `${activeFolder.location} · ${totalItems} item${totalItems === 1 ? "" : "s"}`
                    : "Pick a collection to see saved places on the map"}
                </DrawerPrimitive.Description>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {!activeFolder ? (
                <VaultPicker onPick={() => setSnap(snapPoints[0])} />
              ) : grouped.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="font-playfair italic-accent text-base text-foreground">
                    No saved places yet
                  </p>
                  <p className="mx-auto mt-2 max-w-xs font-inter text-[12px] leading-relaxed text-muted-foreground">
                    Use “Find a place” above to add your first pin.
                  </p>
                </div>
              ) : (
                grouped.map((g) => {
                  const Icon = CAT_META[g.key].icon;
                  return (
                    <div key={g.key}>
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-5 py-2 backdrop-blur">
                        <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                        <span className="font-inter text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {CAT_META[g.key].label}
                        </span>
                        <span className="ml-auto font-inter text-[10px] text-muted-foreground">
                          {g.items.length}
                        </span>
                      </div>
                      {g.items.map((item) => (
                        <PlaceRow
                          key={item.id}
                          item={item}
                          onSelect={() => {
                            setFocusItemId(item.id);
                            setSnap(snapPoints[0]);
                          }}
                        />
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>

      <FolderSwitcherDrawer open={folderDrawerOpen} onOpenChange={setFolderDrawerOpen} />
      <PasteSocialDialog open={socialOpen} onOpenChange={setSocialOpen} />
    </div>
  );
}