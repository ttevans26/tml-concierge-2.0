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

type Mode = "create" | "edit";
type PropertyType = "hotel" | "airbnb";

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripStart: string;
  tripEnd: string;
  legs: LocationLeg[];
}

type Props =
  | (BaseProps & { mode: "create"; defaultDate: string; pill?: undefined })
  | (BaseProps & { mode: "edit"; pill: StayPill; defaultDate?: undefined });

/**
 * Unified Stay dialog used for both creation (clicking an empty Stays cell)
 * and editing (clicking an existing stay pill). One schema, one popup.
 *
 * Persistence shape on `itinerary_items`:
 *   date              = check-in
 *   cost              = final total (calculated or user override)
 *   source_url        = listing URL (Airbnb only)
 *   confirmation_code = code
 *   metadata          = {
 *     end_date, check_out, property_type, nightly_rate,
 *     taxes_fees, cleaning_fee?, total_override?
 *   }
 */
export default function StayDialog(props: Props) {
  const { open, onOpenChange, tripId, tripStart, tripEnd, legs, mode } = props;
  const pill = mode === "edit" ? props.pill : null;
  const item = pill?.firstItem ?? null;

  const initialMeta = useMemo<Record<string, unknown>>(
    () => ((item?.metadata as Record<string, unknown> | null) || {}),
    [item],
  );

  const initialCheckIn = mode === "edit" ? pill!.startDate : props.defaultDate;
  const initialCheckOut =
    mode === "edit"
      ? format(addDays(parseISO(pill!.endDate), 1), "yyyy-MM-dd")
      : format(addDays(parseISO(props.defaultDate), 1), "yyyy-MM-dd");

  // ---- form state ----
  const [title, setTitle] = useState(item?.title ?? "");
  const [propertyType, setPropertyType] = useState<PropertyType>(
    (initialMeta.property_type as PropertyType) === "airbnb" ? "airbnb" : "hotel",
  );
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(item?.google_place_id ?? null);
  const [locationName, setLocationName] = useState<string>(item?.location_name ?? "");
  const [lat, setLat] = useState<number | null>(item?.location_lat ?? null);
  const [lng, setLng] = useState<number | null>(item?.location_lng ?? null);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [nightlyRate, setNightlyRate] = useState<string>(
    typeof initialMeta.nightly_rate === "number" ? String(initialMeta.nightly_rate) : "",
  );
  const [taxesFees, setTaxesFees] = useState<string>(
    typeof initialMeta.taxes_fees === "number" ? String(initialMeta.taxes_fees) : "",
  );
  const [cleaningFee, setCleaningFee] = useState<string>(
    typeof initialMeta.cleaning_fee === "number" ? String(initialMeta.cleaning_fee) : "",
  );
  const [listingUrl, setListingUrl] = useState<string>(item?.source_url ?? "");
  const [confirmationCode, setConfirmationCode] = useState(item?.confirmation_code ?? "");
  const [totalOverride, setTotalOverride] = useState<string>(
    typeof initialMeta.total_override === "number" ? String(initialMeta.total_override) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const prevOpen = useRef(false);

  // Re-seed state only on open transitions so parent re-renders don't wipe edits.
  useEffect(() => {
    if (!open) {
      prevOpen.current = false;
      return;
    }
    if (prevOpen.current) return;
    prevOpen.current = true;
    const it = item;
    const meta = (it?.metadata as Record<string, unknown> | null) || {};
    setTitle(it?.title ?? "");
    setPropertyType((meta.property_type as PropertyType) === "airbnb" ? "airbnb" : "hotel");
    setGooglePlaceId(it?.google_place_id ?? null);
    setLocationName(it?.location_name ?? "");
    setLat(it?.location_lat ?? null);
    setLng(it?.location_lng ?? null);
    setCheckIn(initialCheckIn);
    setCheckOut(initialCheckOut);
    setNightlyRate(typeof meta.nightly_rate === "number" ? String(meta.nightly_rate) : "");
    setTaxesFees(typeof meta.taxes_fees === "number" ? String(meta.taxes_fees) : "");
    setCleaningFee(typeof meta.cleaning_fee === "number" ? String(meta.cleaning_fee) : "");
    setListingUrl(it?.source_url ?? "");
    setConfirmationCode(it?.confirmation_code ?? "");
    setTotalOverride(typeof meta.total_override === "number" ? String(meta.total_override) : "");
  }, [open, item, initialCheckIn, initialCheckOut]);

  const tripStartDate = useMemo(() => parseISO(tripStart), [tripStart]);
  const tripEndDate = useMemo(() => parseISO(tripEnd), [tripEnd]);
  // Allow check-out the morning after trip end (very common).
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

  const rateNum = parseFloat(nightlyRate) || 0;
  const taxesNum = parseFloat(taxesFees) || 0;
  const cleaningNum = parseFloat(cleaningFee) || 0;
  const calculatedTotal =
    rateNum * nights + taxesNum + (propertyType === "airbnb" ? cleaningNum : 0);
  const overrideNum = totalOverride.trim() === "" ? null : parseFloat(totalOverride);
  const isOverridden = overrideNum != null && !Number.isNaN(overrideNum);
  const finalTotal = isOverridden ? (overrideNum as number) : calculatedTotal;

  const derivedLocation = useMemo(() => {
    const leg = legs.find((l) => checkIn >= l.startDate && checkIn <= l.endDate);
    return leg ? leg.city : null;
  }, [legs, checkIn]);

  const handlePlaceSelect = useCallback((p: PlacePick) => {
    setTitle(p.mainText || p.description);
    setLocationName(p.secondaryText || p.description);
    setGooglePlaceId(p.placeId);
  }, []);

  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);
  const deleteItineraryItem = useTripStore((s) => s.deleteItineraryItem);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || nights < 1) {
      toast.error("Check-out must be at least one night after check-in.");
      return;
    }
    setSubmitting(true);

    const endDateInclusive = format(addDays(parseISO(checkOut), -1), "yyyy-MM-dd");
    const baseMeta = ((item?.metadata as Record<string, unknown> | null) || {});
    const nextMeta: Record<string, unknown> = {
      ...baseMeta,
      end_date: endDateInclusive,
      check_out: checkOut,
      property_type: propertyType,
    };
    if (nightlyRate.trim()) nextMeta.nightly_rate = rateNum; else delete (nextMeta as { nightly_rate?: unknown }).nightly_rate;
    if (taxesFees.trim()) nextMeta.taxes_fees = taxesNum; else delete (nextMeta as { taxes_fees?: unknown }).taxes_fees;
    if (propertyType === "airbnb" && cleaningFee.trim()) nextMeta.cleaning_fee = cleaningNum;
    else delete (nextMeta as { cleaning_fee?: unknown }).cleaning_fee;
    if (isOverridden) nextMeta.total_override = overrideNum as number;
    else delete (nextMeta as { total_override?: unknown }).total_override;

    const payload = {
      title: title.trim(),
      date: checkIn,
      location_name: locationName.trim() || null,
      google_place_id: googlePlaceId,
      location_lat: lat,
      location_lng: lng,
      cost: finalTotal > 0 ? finalTotal : null,
      confirmation_code: confirmationCode.trim() || null,
      source_url: propertyType === "airbnb" ? (listingUrl.trim() || null) : null,
      metadata: nextMeta,
    } as Partial<ItineraryItem>;

    try {
      if (mode === "edit" && item) {
        await updateItineraryItem(item.id, payload);
        // Legacy multi-row pills → collapse trailing per-night rows.
        if (pill && !pill.isRange && pill.itemIds.length > 1) {
          const extras = pill.itemIds.filter((id) => id !== item.id);
          for (const id of extras) await deleteItineraryItem(id);
        }
        toast.success("Stay updated");
      } else {
        await createItineraryItem({
          trip_id: tripId,
          category: "stays",
          ...payload,
        } as Parameters<typeof createItineraryItem>[0]);
        toast.success("Stay added");
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save stay", err);
      toast.error("Failed to save stay");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pill) return;
    setSubmitting(true);
    try {
      for (const id of pill.itemIds) await deleteItineraryItem(id);
      toast.success("Stay removed");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to delete stay", err);
      toast.error("Failed to delete stay");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl text-foreground">
            {mode === "edit" ? "Edit Stay" : "Add Stay"}
          </DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            Property, dates, and cost — location is derived from your trip segments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property type toggle */}
          <div className="space-y-2">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Property Type
            </Label>
            <div className="inline-flex rounded-sm border-thin border-border overflow-hidden">
              {(["hotel", "airbnb"] as PropertyType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPropertyType(t)}
                  className={cn(
                    "min-h-[36px] px-4 font-inter text-xs capitalize transition-colors",
                    propertyType === t
                      ? "bg-accent text-accent-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
              Property Name
            </Label>
            <PlaceAutocomplete
              value={title}
              onChange={setTitle}
              onSelect={handlePlaceSelect}
              placeholder={propertyType === "airbnb" ? "Search address or area…" : "Search hotel or property…"}
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
                      "w-full justify-start border-thin border-border bg-background font-inter text-sm font-normal min-h-[44px]",
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
                      "w-full justify-start border-thin border-border bg-background font-inter text-sm font-normal min-h-[44px]",
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
                Nightly Rate
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={nightlyRate}
                onChange={(e) => setNightlyRate(e.target.value)}
                placeholder="0.00"
                className="border-thin border-border bg-background font-inter text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Taxes &amp; Fees
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={taxesFees}
                onChange={(e) => setTaxesFees(e.target.value)}
                placeholder="optional"
                className="border-thin border-border bg-background font-inter text-sm"
              />
            </div>
          </div>

          {propertyType === "airbnb" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Cleaning Fee
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(e.target.value)}
                  placeholder="optional"
                  className="border-thin border-border bg-background font-inter text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                  Listing URL
                </Label>
                <Input
                  type="url"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="airbnb.com/rooms/…"
                  className="border-thin border-border bg-background font-inter text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Total Cost
              </Label>
              <span className="font-inter text-[10px] text-muted-foreground">
                Calculated: <span className="text-foreground">{fmt(calculatedTotal)}</span>
              </span>
            </div>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={totalOverride}
              onChange={(e) => setTotalOverride(e.target.value)}
              placeholder={fmt(calculatedTotal)}
              className="border-thin border-border bg-background font-inter text-sm"
            />
            {isOverridden && (
              <button
                type="button"
                onClick={() => setTotalOverride("")}
                className="font-inter text-[10px] text-accent hover:underline"
              >
                Reset to calculated total
              </button>
            )}
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
            {mode === "edit" ? (
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
            ) : (
              <span />
            )}
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
                {submitting ? "Saving…" : mode === "edit" ? "Save" : "Add Stay"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}