import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTripStore } from "@/stores/useTripStore";
import type { ItineraryItem } from "@/stores/useTripStore";

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItineraryItem;
}

const CATEGORIES: { key: ItineraryItem["category"]; label: string }[] = [
  { key: "stays", label: "Stays" },
  { key: "logistics", label: "Logistics" },
  { key: "dining", label: "Dining" },
  { key: "agenda", label: "Agenda" },
];

export default function EditItemDialog({ open, onOpenChange, item }: EditItemDialogProps) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState<ItineraryItem["category"]>(item.category);
  const [cost, setCost] = useState(item.cost != null ? String(item.cost) : "");
  const [submitting, setSubmitting] = useState(false);
  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);
  const deleteItineraryItem = useTripStore((s) => s.deleteItineraryItem);

  useEffect(() => {
    setTitle(item.title);
    setCategory(item.category);
    setCost(item.cost != null ? String(item.cost) : "");
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await updateItineraryItem(item.id, {
      title: title.trim(),
      category,
      cost: cost ? parseFloat(cost) : null,
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    setSubmitting(true);
    await deleteItineraryItem(item.id);
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-playfair text-lg text-foreground">
            Edit Item
          </DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            {item.date} · {item.category}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="border-thin border-border bg-background font-inter text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Category
            </Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ItineraryItem["category"])}>
              <SelectTrigger className="border-thin border-border bg-background font-inter text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Cost ($)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="border-thin border-border bg-background font-inter text-sm"
            />
          </div>

          <DialogFooter className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
              className="font-inter text-xs"
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="font-inter text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !title.trim()}
                className="bg-accent text-accent-foreground font-inter text-xs hover:bg-accent/90"
              >
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
