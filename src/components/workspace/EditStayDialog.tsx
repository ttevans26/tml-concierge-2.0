import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarIcon, MapPin, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import PlaceAutocomplete, { type PlacePick } from "@/components/ui/PlaceAutocomplete";
import { useTripStore, type ItineraryItem } from "@/stores/useTripStore";
import { toast } from "sonner";
import type { StayPill, LocationLeg } from "@/lib/locationLegs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The pill being edited (provides startDate/endDate, legacy itemIds, etc.). */
  pill: StayPill;
  tripStart: string;
  tripEnd: string;
  /** Active Location legs — used to display the derived city chip. */
  legs: LocationLeg[];
}

/**
 * Range-based Edit Stay dialog.
 *
 * Stores one itinerary_items row per Stay with:
 *   date           = check-in
 *   metadata.end_date = last night (inclusive)
 *
 * When opened on a legacy multi-row pill (per-night rows), Save converts to the
 * range model: keep the first row, delete the rest, write metadata.end_date.
 */
export default function EditStayDialog({
  open,
  onOpenChange,
  pill,
  tripStart,
  tripEnd,
  legs,
}: Props) {
  const item = pill.firstItem;

  const [title, setTitle] = useState(item.title);
  const [locationName, setLocationName] = useState<string>(item.location_name ?? "");
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(item.google_place_id ?? null);
  const [lat, setLat] = useState<number | null>(item.location_lat ?? null);
  const [lng, setLng] = useState<number | null>(item.location_lng ?? null);
  const [checkIn, setCheckIn] = useState(pill.startDate);
  // Check-out is morning-of (exclusive). end_date stored = checkOut - 1 day.
  const [checkOut, setCheckOut] = useState(
    format(addDays(parseISO(pill.endDate), 1), "yyyy-MM-dd"),
  );
  const [cost, setCost] = useState<string>(item.cost != null ? String(item.cost) : "");
  const [nightlyRate, setNightlyRate] = useState<string>(() => {
    const meta = (item.metadata as Record<string, unknown> | null) || {};
    const r = meta.nightly_rate;
    return typeof r === "number" ? String(r) : "";
  });
  const [confirmationCode, setConfirmationCode] = useState(item.confirmation_code ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const prevOpen = useRef(false);

  // Only initialise state on the open transition so parent re-renders don't wipe edits.
  useEffect(() => {
    if (!open) {
      prevOpen.current = false;
      return;
    }
    if (prevOpen.current) return;
    prevOpen.current = true;
    const it = pill.firstItem;
    const meta = (it.metadata as Record<string, unknown> | null) || {};
    setTitle(it.title);
    setLocationName(it.location_name ?? "");
    setGooglePlaceId(it.google_place_id ?? null);
    setLat(it.location_lat ?? null);
    setLng(it.location_lng ?? null);
    setCheckIn(pill.startDate);
    setCheckOut(format(addDays(parseISO(pill.endDate), 1), "yyyy-MM-dd"));
    setCost(it.cost != null ? String(it.cost) : "");
    setNightlyRate(typeof meta.nightly_rate === "number" ? String(meta.nightly_rate) : "");
    setConfirmationCode(it.confirmation_code ?? "");
  }, [open, pill]);

  const tripStartDate = useMemo(() => parseISO(tripStart), [tripStart]);
  const tripEndDate = useMemo(() => parseISO(tripEnd), [tripEnd]);
  // Allow check-out to be the day after the trip's last day (very common: leave on the morning of departure day).
  const checkOutMax = useMemo(() => addDays(tripEndDate, 1), [tripEndDate]);

  const checkInDate = useMemo(() => {
    try { return parseISO(checkIn); } catch { return undefined; }
  }, [checkIn]);
  const checkOutDate = useMemo(() => {
    try { return parseISO(checkOut); } catch { return undefined; }
  }, [checkOut]);

  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    return Math.max(0, differenceInCalendarDays(checkOutDate, checkInDate));
  }, [checkInDate, checkOutDate]);

  const derivedLocation = useMemo(() => {
    const leg = legs.find((l) => checkIn >= l.startDate && checkIn <= l.endDate);
    return leg ? leg.city : null;
  }, [legs, checkIn]);

  const handlePlaceSelect = useCallback((p: PlacePick) => {
    setTitle(p.mainText || p.description);
    setLocationName(p.secondaryText || p.description);
    setGooglePlaceId(p.placeId);
  }, []);

  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);
  const deleteItineraryItem = useTripStore((s) => s.deleteItineraryItem);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || nights < 1) {
      toast.error("Check-out must be at least one night after check-in.");
      return;
    }
    setSubmitting(true);

    // Compute last-night (inclusive) from check-out (exclusive).
    const endDateInclusive = format(addDays(parseISO(checkOut), -1), "yyyy-MM-dd");
    const meta = ((item.metadata as Record<string, unknown> | null) || {});
    const nextMeta: Record<string, unknown> = {
      ...meta,
      end_date: endDateInclusive,
      check_out: checkOut, // exclusive, for display convenience
    };
    if (nightlyRate.trim()) nextMeta.nightly_rate = parseFloat(nightlyRate);
    else delete (nextMeta as { nightly_rate?: unknown }).nightly_rate;

    const payload: Partial<ItineraryItem> = {
      title: title.trim(),
      date: checkIn,
      location_name: locationName.trim() || null,
      google_place_id: googlePlaceId,
      location_lat: lat,
      location_lng: lng,
      cost: cost.trim() ? parseFloat(cost) : null,
      confirmation_code: confirmationCode.trim() || null,
      metadata: nextMeta,
    };

    try {
      await updateItineraryItem(item.id, payload);
      // Legacy multi-row pill → delete the trailing per-night rows.
      if (!pill.isRange && pill.itemIds.length > 1) {
        const extras = pill.itemIds.filter((id) => id !== item.id);
        for (const id of extras) {
          await deleteItineraryItem(id);
        }
      }
      toast.success("Stay updated");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update stay", err);
      toast.error("Failed to update stay");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      for (const id of pill.itemIds) {
        await deleteItineraryItem(id);
      }
      toast.success("Stay removed");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to delete stay", err);
      toast.error("Failed to delete stay");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl text-foreground">Edit Stay</DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            Set check-in and check-out — location is derived from your trip segments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Property
            </Label>
            <PlaceAutocomplete
              value={title}
              onChange={setTitle}
              onSelect={handlePlaceSelect}
              placeholder="Search hotel or property…"
              types="establishment"
            />
          </div>

          {derivedLocation && (
            <div className="inline-flex items-center gap-1.5 rounded-sm border-thin border-border bg-secondary/40 px-2 py-1 font-inter text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Inside <span className="font-medium text-foreground">{derivedLocation}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Check-in
              </Label>
              <Popover open={checkInOpen} onOpenChange={setCheckInOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start border-thin border-border bg-background font-inter text-sm font-normal",
                      !checkInDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {checkInDate ? format(checkInDate, "EEE, MMM d") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkInDate}
                    onSelect={(d) => {
                      if (!d) return;
                      const iso = format(d, "yyyy-MM-dd");
                      setCheckIn(iso);
                      // Keep check-out strictly after check-in; nudge it forward if needed.
                      if (checkOut <= iso) {
                        setCheckOut(format(addDays(d, 1), "yyyy-MM-dd"));
                      }
                      setCheckInOpen(false);
                    }}
                    defaultMonth={checkInDate ?? tripStartDate}
                    disabled={{ before: tripStartDate, after: tripEndDate }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Check-out
              </Label>
              <Popover open={checkOutOpen} onOpenChange={setCheckOutOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start border-thin border-border bg-background font-inter text-sm font-normal",
                      !checkOutDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {checkOutDate ? format(checkOutDate, "EEE, MMM d") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkOutDate}
                    onSelect={(d) => {
                      if (!d) return;
                      setCheckOut(format(d, "yyyy-MM-dd"));
                      setCheckOutOpen(false);
                    }}
                    defaultMonth={checkOutDate ?? checkInDate ?? tripStartDate}
                    disabled={{
                      before: checkInDate ? addDays(checkInDate, 1) : tripStartDate,
                      after: checkOutMax,
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
            {nights} night{nights === 1 ? "" : "s"}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Total Cost
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
            <div className="space-y-2">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Nightly Rate
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={nightlyRate}
                onChange={(e) => setNightlyRate(e.target.value)}
                placeholder="optional"
                className="border-thin border-border bg-background font-inter text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Confirmation Code
            </Label>
            <Input
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="optional"
              className="border-thin border-border bg-background font-inter text-sm"
            />
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={handleDelete}
              className="font-inter text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
            <div className="flex gap-2">
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
                disabled={submitting || !title.trim() || nights < 1}
                className="bg-accent text-accent-foreground font-inter text-sm hover:bg-accent/90"
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