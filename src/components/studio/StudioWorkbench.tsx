import { useState } from "react";
import { Plus, ExternalLink, Trash2, Hotel, UtensilsCrossed, Compass, Landmark, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudioStore, StudioCategory, StudioItem } from "@/stores/useStudioStore";

const CATEGORIES: { key: StudioCategory; label: string; icon: React.ElementType; colorClass: string; watermark: string }[] = [
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

export default function StudioWorkbench() {
  const { activeFolder, addItem } = useStudioStore();
  const [addOpen, setAddOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<StudioCategory>("stays");

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
                {item.cost != null && (
                  <p className="mt-0.5 font-inter text-[10px] font-medium text-accent">
                    ${item.cost.toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteItem(item.folderId, item.id)}
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
            <Label className="font-inter text-xs">URL (optional)</Label>
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
