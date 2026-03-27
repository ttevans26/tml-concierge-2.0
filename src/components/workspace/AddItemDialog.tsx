import { useState } from "react";
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
import { useTripStore } from "@/stores/useTripStore";
import type { ItineraryItem } from "@/stores/useTripStore";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  date: string;
  category: ItineraryItem["category"];
}

const CATEGORY_LABELS: Record<ItineraryItem["category"], string> = {
  stays: "Stay",
  logistics: "Logistics",
  dining: "Dining",
  agenda: "Agenda",
};

export default function AddItemDialog({
  open,
  onOpenChange,
  tripId,
  date,
  category,
}: AddItemDialogProps) {
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createItineraryItem = useTripStore((s) => s.createItineraryItem);

  const reset = () => {
    setTitle("");
    setCost("");
    setStartTime("");
    setEndTime("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await createItineraryItem({
      trip_id: tripId,
      category,
      date,
      title: title.trim(),
      cost: cost ? parseFloat(cost) : null,
      start_time: startTime || null,
      end_time: endTime || null,
    });
    setSubmitting(false);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-playfair text-lg text-foreground">
            Add {CATEGORY_LABELS[category]}
          </DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            {date} · {CATEGORY_LABELS[category]}
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
              placeholder="e.g. Park Hyatt Tokyo"
              required
              className="border-thin border-border bg-background font-inter text-sm"
            />
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Start Time
              </Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border-thin border-border bg-background font-inter text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                End Time
              </Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border-thin border-border bg-background font-inter text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
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
              {submitting ? "Adding…" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
