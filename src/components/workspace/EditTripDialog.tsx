import { useEffect, useMemo, useState } from "react";
import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import { CalendarIcon, ArrowRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { useTripStore } from "@/stores/useTripStore";
import { buildSegments, computeReorderPatches, type LocationSegment } from "@/lib/segments";
import SegmentCard from "./SegmentCard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditTripDialog({ open, onOpenChange }: Props) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const items = useTripStore((s) => s.itineraryItems);
  const updateTrip = useTripStore((s) => s.updateTrip);
  const shiftTripDates = useTripStore((s) => s.shiftTripDates);
  const bulkUpdateItemDates = useTripStore((s) => s.bulkUpdateItemDates);

  /* ---------- Dates tab state ---------- */
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [shiftDays, setShiftDays] = useState("");
  const [savingDates, setSavingDates] = useState(false);

  /* ---------- Segments tab state ---------- */
  const [order, setOrder] = useState<LocationSegment[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Recompute segments + reset local form whenever the dialog re-opens
  const baseSegments = useMemo(
    () => (activeTrip ? buildSegments(activeTrip, items) : []),
    [activeTrip, items],
  );

  useEffect(() => {
    if (!open || !activeTrip) return;
    setStartDate(activeTrip.start_date ? parseISO(activeTrip.start_date) : undefined);
    setEndDate(activeTrip.end_date ? parseISO(activeTrip.end_date) : undefined);
    setShiftDays("");
    setOrder(baseSegments);
  }, [open, activeTrip, baseSegments]);

  if (!activeTrip) return null;

  /* ---------- Dates tab handlers ---------- */
  const currentStart = activeTrip.start_date ? parseISO(activeTrip.start_date) : null;
  const currentEnd = activeTrip.end_date ? parseISO(activeTrip.end_date) : null;

  const proposedNights =
    startDate && endDate ? differenceInCalendarDays(endDate, startDate) + 1 : 0;

  const startDelta =
    startDate && currentStart ? differenceInCalendarDays(startDate, currentStart) : 0;
  const endDelta =
    endDate && currentEnd ? differenceInCalendarDays(endDate, currentEnd) : 0;

  const handleSaveDates = async () => {
    if (!startDate || !endDate) {
      toast.error("Pick both a start and end date");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after start date");
      return;
    }
    setSavingDates(true);
    await updateTrip(activeTrip.id, {
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
    });
    setSavingDates(false);
    toast.success("Trip dates updated");
  };

  const handleShift = async () => {
    const delta = parseInt(shiftDays, 10);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error("Enter a non-zero number of days");
      return;
    }
    setSavingDates(true);
    const ok = await shiftTripDates(activeTrip.id, delta);
    setSavingDates(false);
    if (ok) {
      toast.success(`Trip shifted ${delta > 0 ? "+" : ""}${delta} day${Math.abs(delta) === 1 ? "" : "s"}`);
      setShiftDays("");
    }
  };

  /* ---------- Segments tab handlers ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((s) => s.id === active.id);
    const newIndex = order.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  const moveSegmentToIndex = (id: string, targetIndex: number) => {
    const idx = order.findIndex((s) => s.id === id);
    if (idx === -1) return;
    setOrder(arrayMove(order, idx, targetIndex));
  };

  const orderChanged = useMemo(
    () => order.map((s) => s.id).join("|") !== baseSegments.map((s) => s.id).join("|"),
    [order, baseSegments],
  );

  const handleApplyOrder = async () => {
    setSavingOrder(true);
    const patches = computeReorderPatches(activeTrip, order, items);
    await bulkUpdateItemDates(patches);
    setSavingOrder(false);
    toast.success(`Reordered ${order.length} segment${order.length === 1 ? "" : "s"}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-playfair text-lg">Edit Trip</DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            Shift dates or lift-and-shift location segments within your itinerary.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dates" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dates" className="font-inter text-xs">
              Dates
            </TabsTrigger>
            <TabsTrigger value="segments" className="font-inter text-xs">
              Itinerary Segments
            </TabsTrigger>
          </TabsList>

          {/* ---------- DATES ---------- */}
          <TabsContent value="dates" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <DateField label="Start" value={startDate} onChange={setStartDate} />
              <DateField label="End" value={endDate} onChange={setEndDate} />
            </div>

            <div className="rounded-sm border border-border bg-muted/30 px-3 py-2 font-inter text-[11px] text-muted-foreground">
              {startDate && endDate ? (
                <>
                  {format(startDate, "MMM d")} → {format(endDate, "MMM d, yyyy")} ·{" "}
                  {proposedNights} day{proposedNights === 1 ? "" : "s"}
                  {(startDelta !== 0 || endDelta !== 0) && (
                    <span className="ml-2 text-accent">
                      ({startDelta !== 0 && `${startDelta > 0 ? "+" : ""}${startDelta}d start`}
                      {startDelta !== 0 && endDelta !== 0 && ", "}
                      {endDelta !== 0 && `${endDelta > 0 ? "+" : ""}${endDelta}d end`})
                    </span>
                  )}
                </>
              ) : (
                "Pick start and end dates"
              )}
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                className="font-inter text-xs"
                onClick={handleSaveDates}
                disabled={savingDates || (startDelta === 0 && endDelta === 0)}
              >
                {savingDates ? "Saving…" : "Save dates"}
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Shift entire trip
              </Label>
              <p className="mb-2 mt-0.5 font-inter text-[11px] text-muted-foreground">
                Moves both start/end and every itinerary item by N days.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="e.g. 7 or -3"
                  value={shiftDays}
                  onChange={(e) => setShiftDays(e.target.value)}
                  className="h-8 w-32 font-inter text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="font-inter text-xs"
                  onClick={handleShift}
                  disabled={savingDates || !shiftDays}
                >
                  Apply shift
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ---------- SEGMENTS ---------- */}
          <TabsContent value="segments" className="mt-4 space-y-3">
            {order.length === 0 ? (
              <div className="rounded-sm border border-border bg-card px-3 py-6 text-center font-inter text-xs text-muted-foreground">
                Add a Stay item to your itinerary to see location segments here.
              </div>
            ) : (
              <>
                <p className="font-inter text-[11px] text-muted-foreground">
                  Drag to reorder. Item dates will be recomputed so each segment keeps its night
                  count, starting from your trip's start date.
                </p>

                {orderChanged && (
                  <div className="rounded-sm border border-accent/40 bg-accent/10 px-3 py-2 font-inter text-[11px] text-foreground">
                    <div className="font-medium">Preview</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-muted-foreground">
                      {baseSegments.map((s, i) => (
                        <span key={`old-${s.id}`} className="flex items-center gap-1">
                          <span className="line-through">{s.location}</span>
                          {i < baseSegments.length - 1 && <ArrowRight className="h-3 w-3" />}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-foreground">
                      {order.map((s, i) => (
                        <span key={`new-${s.id}`} className="flex items-center gap-1">
                          {s.location}
                          {i < order.length - 1 && <ArrowRight className="h-3 w-3" />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={order.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                      {order.map((seg, i) => (
                        <SegmentCard
                          key={seg.id}
                          segment={seg}
                          index={i}
                          total={order.length}
                          onMoveToStart={(id) => moveSegmentToIndex(id, 0)}
                          onMoveToEnd={(id) => moveSegmentToIndex(id, order.length - 1)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-inter text-xs"
                    onClick={() => setOrder(baseSegments)}
                    disabled={!orderChanged || savingOrder}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    className="font-inter text-xs"
                    onClick={handleApplyOrder}
                    disabled={!orderChanged || savingOrder}
                  >
                    {savingOrder ? "Applying…" : "Apply reorder"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Inline date picker ---------- */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-8 w-full justify-start gap-2 font-inter text-xs",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {value ? format(value, "MMM d, yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}