import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Hotel, UtensilsCrossed, Compass, Landmark, FolderOpen,
  GripVertical, ChevronDown, Archive, Filter, Sparkles, RefreshCw, Loader2,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useStudioStore, type StudioFolder, type StudioItem } from "@/stores/useStudioStore";
import { useTripStore } from "@/stores/useTripStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ---- helpers ---- */

const CATEGORY_META: Record<string, { icon: React.ElementType; label: string }> = {
  stays: { icon: Hotel, label: "Stay" },
  dining: { icon: UtensilsCrossed, label: "Dining" },
  activity: { icon: Compass, label: "Activity" },
  sites: { icon: Landmark, label: "Site" },
};

function categoryMeta(cat: string) {
  return CATEGORY_META[cat] || CATEGORY_META.activity;
}

function relevanceScore(folder: StudioFolder, destination: string): number {
  if (!destination) return 0;
  const dest = destination.toLowerCase();
  const words = dest.split(/[\s,]+/).filter((w) => w.length > 2);
  const target = `${folder.name} ${folder.location}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (target.includes(w)) score += 1;
  }
  return score;
}

/* ---- Draggable item card ---- */

function DraggableStudioItem({ item, isConcierge }: { item: StudioItem; isConcierge?: boolean }) {
  const meta = categoryMeta(item.category);
  const Icon = meta.icon;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/studio-item", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group flex cursor-grab items-start gap-2 rounded-sm border px-2.5 py-2 transition-shadow active:cursor-grabbing hover:shadow-sm ${
        isConcierge
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-card"
      }`}
    >
      <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
      {isConcierge ? (
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent" strokeWidth={1.5} />
      ) : (
        <Icon className="mt-0.5 h-3 w-3 shrink-0 text-accent" strokeWidth={1.5} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-[11px] font-medium text-foreground">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 font-inter text-[10px] text-muted-foreground italic">
            {item.description}
          </p>
        )}
      </div>
      {item.cost != null && (
        <Badge variant="outline" className="shrink-0 font-inter text-[9px]">
          ${Number(item.cost).toLocaleString()}
        </Badge>
      )}
    </div>
  );
}

/* ---- Folder section ---- */

function FolderSection({ folder, defaultOpen }: { folder: StudioFolder; defaultOpen?: boolean }) {
  return (
    <AccordionItem value={folder.id} className="border-b-0">
      <AccordionTrigger className="py-2.5 px-4 hover:no-underline">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <span className="font-inter text-[11px] font-medium text-foreground">
            {folder.name}
          </span>
          <Badge variant="secondary" className="font-inter text-[9px]">
            {folder.items.length}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-2">
        <div className="space-y-1.5">
          {folder.items.length === 0 ? (
            <p className="font-inter text-[10px] text-muted-foreground italic">
              No items yet
            </p>
          ) : (
            folder.items.map((item) => (
              <DraggableStudioItem key={item.id} item={item} />
            ))
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/* ---- Concierge Inspiration Section ---- */

function ConciergeInspirationSection() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const [suggestions, setSuggestions] = useState<StudioItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const prevDestRef = useRef(activeTrip?.destination);
  const prevDatesRef = useRef(`${activeTrip?.start_date}-${activeTrip?.end_date}`);

  const fetchSuggestions = useCallback(async () => {
    if (!activeTrip?.destination) return;
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-concierge-suggestions", {
        body: {
          destination: activeTrip.destination,
          startDate: activeTrip.start_date,
          endDate: activeTrip.end_date,
          existingItems: itineraryItems.map((i) => ({
            category: i.category,
            title: i.title,
            date: i.date,
          })),
        },
      });
      if (error) throw error;
      setSuggestions(data?.suggestions || []);
    } catch (e: any) {
      console.error("Concierge error:", e);
      toast.error("Could not fetch suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  }, [activeTrip?.destination, activeTrip?.start_date, activeTrip?.end_date, itineraryItems]);

  // Auto-refresh when destination or dates change
  useEffect(() => {
    const newDest = activeTrip?.destination || "";
    const newDates = `${activeTrip?.start_date}-${activeTrip?.end_date}`;
    if (newDest && (newDest !== prevDestRef.current || newDates !== prevDatesRef.current)) {
      prevDestRef.current = newDest;
      prevDatesRef.current = newDates;
      fetchSuggestions();
    }
  }, [activeTrip?.destination, activeTrip?.start_date, activeTrip?.end_date, fetchSuggestions]);

  if (!activeTrip?.destination) return null;

  return (
    <div className="border-t border-accent/20">
      {/* Header with gradient accent */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30">
            <Sparkles className="h-3 w-3 text-accent" strokeWidth={2} />
          </div>
          <span className="font-inter text-[11px] font-semibold text-accent">
            Concierge Inspiration
          </span>
          {suggestions.length > 0 && (
            <Badge className="bg-accent/15 text-accent border-accent/30 font-inter text-[9px]">
              {suggestions.length}
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-3">
          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSuggestions}
            disabled={loadingSuggestions}
            className="mb-2 w-full h-7 font-inter text-[10px] border-accent/20 text-accent hover:bg-accent/5"
          >
            {loadingSuggestions ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3 w-3" />
            )}
            {loadingSuggestions ? "Generating…" : "Refresh Suggestions"}
          </Button>

          {/* Suggestion items */}
          <div className="space-y-1.5">
            {suggestions.length === 0 && !loadingSuggestions && (
              <p className="font-inter text-[10px] text-muted-foreground italic text-center py-2">
                Click refresh to get AI-powered suggestions for your trip.
              </p>
            )}
            {suggestions.map((item) => (
              <DraggableStudioItem key={item.id} item={item} isConcierge />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Main sidebar ---- */

export default function StudioSidebar() {
  const { folders, loading, fetchFolders } = useStudioStore();
  const activeTrip = useTripStore((s) => s.activeTrip);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const destination = activeTrip?.destination || "";

  const { relevant, global } = useMemo(() => {
    if (!destination) return { relevant: [], global: folders };

    const scored = folders.map((f) => ({
      folder: f,
      score: relevanceScore(f, destination),
    }));

    const relevant = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.folder);

    const relevantIds = new Set(relevant.map((f) => f.id));
    const global = folders.filter((f) => !relevantIds.has(f.id));

    return { relevant, global };
  }, [folders, destination]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Studio Folders
        </h2>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <p className="font-inter text-[10px] text-muted-foreground animate-pulse">
              Loading collections…
            </p>
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary">
              <FolderOpen className="h-4 w-4 text-accent" strokeWidth={1.5} />
            </div>
            <p className="font-inter text-xs text-muted-foreground leading-relaxed">
              No Studio collections yet. Create folders in the Studio to see them here.
            </p>
          </div>
        ) : (
          <div className="py-2">
            {relevant.length > 0 && (
              <div>
                <div className="px-4 pb-1 pt-2">
                  <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-accent">
                    Matched to "{destination}"
                  </p>
                </div>
                <Accordion type="multiple" defaultValue={relevant.map((f) => f.id)}>
                  {relevant.map((folder) => (
                    <FolderSection key={folder.id} folder={folder} defaultOpen />
                  ))}
                </Accordion>
              </div>
            )}

            {global.length > 0 && (
              <div>
                <div className="px-4 pb-1 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Archive className="h-3 w-3 text-muted-foreground" />
                    <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Global Vault
                    </p>
                  </div>
                </div>
                <Accordion type="multiple">
                  {global.map((folder) => (
                    <FolderSection key={folder.id} folder={folder} />
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        )}

        {/* Concierge Inspiration — always at the bottom */}
        <ConciergeInspirationSection />
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-20 left-4 z-40 h-12 w-12 rounded-full shadow-md touch-manipulation"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70vh] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Studio Folders</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {sidebarContent}
    </div>
  );
}
