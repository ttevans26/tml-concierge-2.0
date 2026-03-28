import { useState } from "react";
import {
  Plus, ExternalLink, Trash2, Hotel, UtensilsCrossed, Compass, Landmark,
  GripVertical, Sparkles, Link, Check, X, Loader2, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudioStore, StudioCategory, StudioItem } from "@/stores/useStudioStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CATEGORIES: {
  key: StudioCategory; label: string; icon: React.ElementType;
  colorClass: string; watermark: string;
}[] = [
  { key: "stays", label: "Stays", icon: Hotel, colorClass: "border-l-[hsl(var(--cell-stays))]", watermark: "e.g., Roseate Villa" },
  { key: "dining", label: "Dining", icon: UtensilsCrossed, colorClass: "border-l-[hsl(var(--cell-dining))]", watermark: "e.g., Chez l'Ami Jean" },
  { key: "activity", label: "Activities", icon: Compass, colorClass: "border-l-[hsl(var(--cell-activity))]", watermark: "e.g., Private Boat Tour" },
  { key: "sites", label: "Sites of Interest", icon: Landmark, colorClass: "border-l-[hsl(var(--cell-sites))]", watermark: "e.g., The Eiffel Tower" },
];

const CATEGORY_BG: Record<StudioCategory, string> = {
  stays: "bg-[hsl(var(--cell-stays))]",
  dining: "bg-[hsl(var(--cell-dining))]",
  activity: "bg-[hsl(var(--cell-activity))]",
  sites: "bg-[hsl(var(--cell-sites))]",
};

/* Mock loyalty badge logic */
const LOYALTY_BADGES: Record<string, { label: string; multiplier: string }> = {
  stays: { label: "Amex Platinum", multiplier: "5x" },
  dining: { label: "Chase Sapphire", multiplier: "3x" },
  activity: { label: "Citi Prestige", multiplier: "2x" },
  sites: { label: "Capital One", multiplier: "2x" },
};

/* Pending scraped item type */
interface PendingItem {
  id: string;
  title: string;
  address: string | null;
  url: string | null;
  category: StudioCategory;
  description: string | null;
}

export default function StudioWorkbench() {
  const { activeFolder, addItem } = useStudioStore();
  const [addOpen, setAddOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<StudioCategory>("stays");

  /* URL Ingestor state */
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  const handleScrape = async () => {
    console.log("DEBUG: Scrape Triggered", scrapeUrl);
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    try {
      console.log("DEBUG: Invoking scrape-and-parse edge function");
      const { data, error } = await supabase.functions.invoke("scrape-and-parse", {
        body: { url: scrapeUrl.trim() },
      });
      console.log("DEBUG: Scrape response", { data, error });
      if (error) throw error;
      const items = data?.items || [];
      if (items.length === 0) {
        toast.info("No travel items found on that page.");
      } else {
        const mapped: PendingItem[] = items.map((item: any) => ({
          id: crypto.randomUUID(),
          title: item.title || "Untitled",
          address: item.address || null,
          url: item.url || scrapeUrl.trim(),
          category: (["stays", "dining", "activity", "sites"].includes(item.category) ? item.category : "activity") as StudioCategory,
          description: item.description || null,
        }));
        setPendingItems((prev) => [...prev, ...mapped]);
        toast.success(`Found ${mapped.length} item${mapped.length !== 1 ? "s" : ""} to review.`);
      }
    } catch (err: any) {
      console.error("DEBUG: Scrape error:", err);
      toast.error(err?.message || "Failed to scrape URL. Please try again.");
    }
    setScrapeUrl("");
    setScraping(false);
  };

  const acceptPending = (item: PendingItem) => {
    if (!activeFolder) return;
    addItem(activeFolder.id, {
      category: item.category,
      title: item.title,
      description: item.description,
      address: item.address,
      url: item.url,
      lat: null,
      lng: null,
      cost: null,
      google_place_id: null,
      source_url: item.url,
      api_metadata: {},
    });
    setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
  };

  const dismissPending = (id: string) => {
    setPendingItems((prev) => prev.filter((p) => p.id !== id));
  };

  if (!activeFolder) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card px-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-thin border-border bg-secondary">
          <Compass className="h-6 w-6 text-accent" strokeWidth={1.5} />
        </div>
        <h3 className="font-playfair text-base font-semibold text-foreground">
          Design Lab
        </h3>
        <p className="mt-2 max-w-xs text-center font-inter text-xs leading-relaxed text-muted-foreground">
          Select a collection from the Ideas Vault to view and curate your research cards.
        </p>
      </div>
    );
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: activeFolder.items.filter((i) => i.category === cat.key),
  }));

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="font-playfair text-sm font-semibold text-foreground">
            {activeFolder.name}
          </h2>
          <p className="font-inter text-[10px] text-muted-foreground">
            {activeFolder.location} · {activeFolder.items.length} items
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-thin font-inter text-xs"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Item
        </Button>
      </div>

      {/* URL Ingestor */}
      <div className="border-b border-border px-5 py-3">
        <Label className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
          Import via URL
        </Label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="Paste a link to scrape inspiration…"
              className="border-thin pl-8 font-inter text-xs h-8"
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-thin font-inter text-xs h-8 gap-1"
            onClick={handleScrape}
            disabled={scraping || !scrapeUrl.trim()}
          >
            {scraping ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {scraping ? "Scraping…" : "Scrape"}
          </Button>
        </div>
      </div>

      {/* Pending Review Tray */}
      {pendingItems.length > 0 && (
        <div className="border-b border-border bg-secondary/30 px-5 py-3">
          <p className="mb-2 font-inter text-[10px] font-semibold uppercase tracking-wider text-accent">
            Review Scraped Items ({pendingItems.length})
          </p>
          <div className="space-y-2">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-sm border-thin border-border bg-card px-3 py-2"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-inter text-xs font-medium text-foreground">
                    {item.title}
                  </p>
                  {item.url && (
                    <p className="truncate font-inter text-[10px] text-muted-foreground">
                      {item.url}
                    </p>
                  )}
                </div>
                <Select
                  value={item.category}
                  onValueChange={(v) =>
                    setPendingItems((prev) =>
                      prev.map((p) => (p.id === item.id ? { ...p, category: v as StudioCategory } : p))
                    )
                  }
                >
                  <SelectTrigger className="h-6 w-24 border-thin font-inter text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key} className="font-inter text-[10px]">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => acceptPending(item)}
                  className="rounded-sm p-1 text-accent hover:bg-accent/10"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => dismissPending(item.id)}
                  className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category lanes */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {grouped.map((cat) => (
          <CategoryLane
            key={cat.key}
            category={cat}
            onAdd={() => {
              setAddCategory(cat.key);
              setAddOpen(true);
            }}
          />
        ))}
      </div>

      {/* Add dialog */}
      <AddStudioItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        category={addCategory}
        onCategoryChange={setAddCategory}
        folderId={activeFolder.id}
      />
    </div>
  );
}

/* ---- Category Lane ---- */

function CategoryLane({
  category,
  onAdd,
}: {
  category: { key: StudioCategory; label: string; icon: React.ElementType; items: StudioItem[] };
  onAdd: () => void;
}) {
  const { deleteItem } = useStudioStore();
  const Icon = category.icon;
  const badge = LOYALTY_BADGES[category.key];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <span className="font-inter text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {category.label}
        </span>
        <span className="font-inter text-[10px] text-muted-foreground">({category.items.length})</span>
        <button onClick={onAdd} className="ml-auto text-muted-foreground hover:text-accent">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {category.items.length === 0 ? (
        <p className="py-3 text-center font-inter text-[10px] text-muted-foreground/60">
          No items yet
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {category.items.map((item) => (
            <div
              key={item.id}
              className={`group relative flex items-start gap-2 rounded-sm border-thin border-border border-l-2 ${CATEGORY_BG[item.category]} p-3 transition-shadow hover:shadow-sm`}
            >
              <GripVertical className="mt-0.5 h-3 w-3 shrink-0 cursor-grab text-muted-foreground/40" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate font-inter text-xs font-medium text-foreground">
                    {item.title}
                  </p>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent hover:text-accent/80">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {item.address && (
                  <p className="mt-0.5 truncate font-inter text-[10px] text-muted-foreground">{item.address}</p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  {item.cost != null && (
                    <span className="font-inter text-[10px] font-medium text-accent">
                      ${item.cost.toLocaleString()}
                    </span>
                  )}
                  {/* Suggestive Loyalty Badge */}
                  {badge && (
                    <span className="inline-flex items-center gap-0.5 rounded-sm border-thin border-border bg-background px-1.5 py-0.5">
                      <CreditCard className="h-2.5 w-2.5 text-accent" />
                      <span className="font-inter text-[8px] text-muted-foreground">
                        💳 {badge.label} ({badge.multiplier})
                      </span>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteItem(item.folder_id, item.id)}
                className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Add Item Dialog ---- */

function AddStudioItemDialog({
  open,
  onOpenChange,
  category,
  onCategoryChange,
  folderId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: StudioCategory;
  onCategoryChange: (c: StudioCategory) => void;
  folderId: string;
}) {
  const { addItem } = useStudioStore();
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");

  const catMeta = CATEGORIES.find((c) => c.key === category)!;

  const handleSave = () => {
    if (!title.trim()) return;
    addItem(folderId, {
      category,
      title: title.trim(),
      description: description.trim() || null,
      address: address.trim() || null,
      url: url.trim() || null,
      lat: null,
      lng: null,
      cost: cost ? parseFloat(cost) : null,
      google_place_id: null,
      source_url: url.trim() || null,
      api_metadata: {},
    });
    setTitle("");
    setAddress("");
    setUrl("");
    setDescription("");
    setCost("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-playfair">Add to Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="font-inter text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => onCategoryChange(v as StudioCategory)}>
              <SelectTrigger className="mt-1 border-thin font-inter text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key} className="font-inter text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-inter text-xs">{catMeta.label} Name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={catMeta.watermark}
              className="mt-1 border-thin font-inter text-sm"
            />
            <p className="mt-1 font-inter text-[9px] text-muted-foreground/60">
              Google Places autocomplete will be available with API integration
            </p>
          </div>
          <div>
            <Label className="font-inter text-xs">Address / Location</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 27 Rue Malar, Paris"
              className="mt-1 border-thin font-inter text-sm"
            />
          </div>
          <div>
            <Label className="font-inter text-xs">Website URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 border-thin font-inter text-sm"
            />
          </div>
          <div>
            <Label className="font-inter text-xs">Notes</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes or context…"
              className="mt-1 border-thin font-inter text-sm"
              rows={2}
            />
          </div>
          <div>
            <Label className="font-inter text-xs">Estimated Cost</Label>
            <Input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="mt-1 border-thin font-inter text-sm"
            />
          </div>
          <Button onClick={handleSave} className="w-full font-inter text-xs" size="sm">
            Save Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
