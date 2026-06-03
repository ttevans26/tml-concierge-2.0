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
import { cn } from "@/lib/utils";
import { RefreshCw, Plane, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItineraryItem;
}

const CATEGORIES: { key: ItineraryItem["category"]; label: string }[] = [
  { key: "stays", label: "Stays" },
  { key: "logistics", label: "Logistics" },
  { key: "dining", label: "Dining" },
  { key: "activity", label: "Activity" },
];

export default function EditItemDialog({ open, onOpenChange, item }: EditItemDialogProps) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState<ItineraryItem["category"]>(item.category);
  const [cost, setCost] = useState(item.cost != null ? String(item.cost) : "");
  const [status, setStatus] = useState<ItineraryItem["approval_status"]>(item.approval_status);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingFlight, setRefreshingFlight] = useState(false);
  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);
  const deleteItineraryItem = useTripStore((s) => s.deleteItineraryItem);

  useEffect(() => {
    setTitle(item.title);
    setCategory(item.category);
    setCost(item.cost != null ? String(item.cost) : "");
    setStatus(item.approval_status);
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await updateItineraryItem(item.id, {
      title: title.trim(),
      category,
      cost: cost ? parseFloat(cost) : null,
      approval_status: status,
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

  const meta = (item.api_metadata as Record<string, any> | null) || null;
  const isFlight =
    item.category === "logistics" && !!(meta?.airline || meta?.flight_status || meta?.gate);

  const handleRefreshFlight = async () => {
    if (!item.title || !item.date) return;
    const flightIata = item.title.replace(/\s+/g, "").toUpperCase();
    setRefreshingFlight(true);
    try {
      const { data, error } = await supabase.functions.invoke("aviationstack-lookup", {
        body: { flight_iata: flightIata, flight_date: item.date },
      });
      if (error || !data?.flight) {
        toast.error(data?.error || error?.message || "Refresh failed");
        return;
      }
      const f = data.flight;
      const nextMeta = {
        ...(meta || {}),
        airline: f.airline,
        terminal: f.terminal,
        gate: f.gate,
        flight_status: f.flight_status,
        delay_minutes: f.delay_minutes,
        last_refreshed_at: new Date().toISOString(),
      };
      const patch: Record<string, unknown> = { api_metadata: nextMeta };
      if (f.departure_time) patch.start_time = format(new Date(f.departure_time), "HH:mm");
      if (f.arrival_time) patch.end_time = format(new Date(f.arrival_time), "HH:mm");
      await updateItineraryItem(item.id, patch as Partial<ItineraryItem>);
      toast.success(`Refreshed · ${f.flight_status ?? "ok"}${f.gate ? ` · Gate ${f.gate}` : ""}`);
    } catch (err: any) {
      toast.error(err?.message || "Refresh failed");
    } finally {
      setRefreshingFlight(false);
    }
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
          {isFlight && (
            <div className="rounded-[2px] border border-border bg-secondary/30 px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-foreground">
                    <Plane className="h-3 w-3 text-accent" />
                    {meta?.airline ?? "Flight"} · {meta?.flight_status ?? "—"}
                  </p>
                  <p className="mt-0.5 font-inter text-[10px] text-muted-foreground">
                    {meta?.gate ? `Gate ${meta.gate}` : "Gate TBD"}
                    {meta?.terminal ? ` · Terminal ${meta.terminal}` : ""}
                    {meta?.delay_minutes ? ` · +${meta.delay_minutes}m delay` : ""}
                  </p>
                  {meta?.last_refreshed_at && (
                    <p className="mt-0.5 font-inter text-[9px] uppercase tracking-wider text-muted-foreground">
                      Updated {format(new Date(meta.last_refreshed_at), "MMM d · h:mm a")}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-[2px] font-inter text-[11px]"
                  disabled={refreshingFlight}
                  onClick={handleRefreshFlight}
                >
                  {refreshingFlight ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  <span className="ml-1">Refresh</span>
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Status
            </Label>
            <div className="flex rounded-[2px] border border-border bg-background p-0.5">
              {([
                { v: "draft" as const, label: "Draft" },
                { v: "confirmed" as const, label: "Confirmed" },
                { v: "cancelled" as const, label: "Cancelled" },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setStatus(opt.v)}
                  className={cn(
                    "flex-1 rounded-[2px] py-1.5 font-inter text-[11px] uppercase tracking-wider transition-colors",
                    status === opt.v
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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
