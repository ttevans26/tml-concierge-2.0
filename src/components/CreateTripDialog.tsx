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

interface CreateTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTripDialog({ open, onOpenChange }: CreateTripDialogProps) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createTrip = useTripStore((s) => s.createTrip);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await createTrip({
      name: name.trim(),
      destination: destination.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
    });
    setSubmitting(false);
    setName("");
    setDestination("");
    setStartDate("");
    setEndDate("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl text-foreground">
            New Journey
          </DialogTitle>
          <DialogDescription className="font-inter text-sm text-muted-foreground">
            Set the essentials — you can refine everything later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
              Trip Name
            </Label>
            <Input
              id="trip-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tokyo in Autumn"
              required
              className="border-thin border-border bg-background font-inter"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
              Destination
            </Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Tokyo, Japan"
              className="border-thin border-border bg-background font-inter"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-thin border-border bg-background font-inter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-thin border-border bg-background font-inter"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="font-inter text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              className="bg-accent text-accent-foreground font-inter text-sm hover:bg-accent/90"
            >
              {submitting ? "Creating…" : "Create Journey"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
