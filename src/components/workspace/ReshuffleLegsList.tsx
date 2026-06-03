import { useMemo, useState } from "react";
import { format, parseISO, addDays, differenceInCalendarDays } from "date-fns";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, MapPin, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { buildSegments, computeReorderPatches, type LocationSegment } from "@/lib/segments";
import type { ItineraryItem, Trip } from "@/stores/useTripStore";
import { useTripStore } from "@/stores/useTripStore";
import type { LocationLeg } from "@/lib/locationLegs";

interface Props {
  trip: Trip;
  items: ItineraryItem[];
  /** Legs sourced from the Matrix Grid (real "location" items or ghost-derived). */
  legs: LocationLeg[];
  onApply: (patches: { id: string; date: string }[]) => Promise<void> | void;
  onClose: () => void;
}

export default function ReshuffleLegsList({ trip, items, legs, onApply, onClose }: Props) {
  const baseSegments = useMemo(() => buildSegments(trip, items), [trip, items]);
  const [order, setOrder] = useState<LocationSegment[]>(baseSegments);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);
  const deleteItineraryItem = useTripStore((s) => s.deleteItineraryItem);
  const updateTrip = useTripStore((s) => s.updateTrip);

  /**
   * Match a segment to the Matrix-Grid leg covering the same window.
   * Legs and segments share start dates when both are derived from stays,
   * but real "location" legs may overlap multiple stay segments — fall back
   * to any leg whose date range overlaps the segment.
   */
  const legForSegment = (seg: LocationSegment): LocationLeg | null => {
    if (seg.isUnassigned) return null;
    const exact = legs.find((l) => l.startDate === seg.startDate);
    if (exact) return exact;
    return (
      legs.find((l) => l.startDate <= seg.endDate && seg.startDate <= l.endDate) ?? null
    );
  };

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
    // Don't allow moving onto an unassigned slot — skip to the next assigned slot
    if (order[newIndex].isUnassigned) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = order.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    if (order[target].isUnassigned) {
      // skip past unassigned blocks
      const skipTarget = target + dir;
      if (skipTarget < 0 || skipTarget >= order.length) return;
      setOrder(arrayMove(order, idx, skipTarget));
      return;
    }
    setOrder(arrayMove(order, idx, target));
  };

  const orderChanged = useMemo(
    () => order.map((s) => s.id).join("|") !== baseSegments.map((s) => s.id).join("|"),
    [order, baseSegments],
  );

  const hasRemovals = removedIds.size > 0;
  const assignedRemaining = order.filter((s) => !s.isUnassigned).length;

  // Live preview dates as if applied (skips removed segments)
  const preview = useMemo(() => {
    if (!trip.start_date) return new Map<string, { start: string; end: string }>();
    const ts = parseISO(trip.start_date);
    let cursor = 0;
    const m = new Map<string, { start: string; end: string }>();
    for (const seg of order) {
      if (removedIds.has(seg.id)) continue;
      const start = format(addDays(ts, cursor), "yyyy-MM-dd");
      const end = format(addDays(ts, cursor + seg.nights - 1), "yyyy-MM-dd");
      m.set(seg.id, { start, end });
      cursor += seg.nights;
    }
    return m;
  }, [order, trip.start_date, removedIds]);

  const totalNights = order
    .filter((s) => !removedIds.has(s.id))
    .reduce((sum, s) => sum + s.nights, 0);

  const handleApply = async () => {
    if (!orderChanged && !hasRemovals) {
      toast.message("Order unchanged.");
      return;
    }
    if (assignedRemaining === 0) {
      toast.error("A trip needs at least one location.");
      return;
    }
    setSaving(true);
    // 1) Delete items inside removed segments
    const removedItemIds: string[] = [];
    for (const seg of order) {
      if (removedIds.has(seg.id)) removedItemIds.push(...seg.itemIds);
    }
    await Promise.all(removedItemIds.map((id) => deleteItineraryItem(id)));

    // 2) Build patches from remaining order only
    const remaining = order.filter((s) => !removedIds.has(s.id));
    const patches = computeReorderPatches(trip, remaining, items)
      .filter((p) => !removedItemIds.includes(p.id));
    await onApply(patches);

    // 3) Shrink trip end_date if we removed nights
    if (hasRemovals && trip.start_date) {
      const newEndIso = format(
        addDays(parseISO(trip.start_date), totalNights - 1),
        "yyyy-MM-dd",
      );
      if (newEndIso !== trip.end_date) {
        await updateTrip(trip.id, { end_date: newEndIso });
      }
    }
    setSaving(false);
    toast.success(hasRemovals ? "Locations updated" : "Locations reshuffled");
    onClose();
  };

  if (baseSegments.length < 2) {
    return (
      <div className="p-4 font-inter text-xs text-muted-foreground">
        Add stays in at least two locations to reshuffle the trip.
      </div>
    );
  }

  const ids = order.map((s) => s.id);
  const tripStart = trip.start_date ? parseISO(trip.start_date) : null;
  const newEnd = tripStart
    ? format(addDays(tripStart, totalNights - 1), "yyyy-MM-dd")
    : null;

  return (
    <div className="flex w-[360px] flex-col">
      <div className="border-b border-border px-3 py-2.5">
        <div className="font-playfair text-sm text-foreground">Reshuffle locations</div>
        <div className="mt-0.5 font-inter text-[10px] text-muted-foreground">
          Drag to reorder. Night counts stay; dates shift automatically.
        </div>
      </div>

      <div className="max-h-[55vh] overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {order.map((seg, idx) => (
                <ReshuffleRow
                  key={seg.id}
                  segment={seg}
                  index={idx}
                  total={order.length}
                  preview={preview.get(seg.id) ?? null}
                  removed={removedIds.has(seg.id)}
                  onMove={(dir) => move(seg.id, dir)}
                  onRemove={() =>
                    setRemovedIds((prev) => {
                      const next = new Set(prev);
                      next.add(seg.id);
                      return next;
                    })
                  }
                  onRestore={() =>
                    setRemovedIds((prev) => {
                      const next = new Set(prev);
                      next.delete(seg.id);
                      return next;
                    })
                  }
                  items={items}
                  leg={legForSegment(seg)}
                  onRename={async (label) => {
                    const trimmed = label.trim();
                    if (!trimmed) return;
                    const leg = legForSegment(seg);
                    // 1) If a real location item backs this leg, update it as the source of truth.
                    if (leg && !leg.isGhost && leg.itemRef) {
                      const prevMeta = (leg.itemRef.metadata as Record<string, unknown>) ?? {};
                      await updateItineraryItem(leg.itemRef.id, {
                        location_name: trimmed,
                        metadata: { ...prevMeta, city: trimmed },
                      });
                    }
                    // 2) Always cascade to the stays in this window so the Matrix
                    //    ghost-leg label and Reshuffle label stay in sync.
                    const stayIds = items
                      .filter(
                        (it) =>
                          it.category === "stays" &&
                          it.date &&
                          it.date >= seg.startDate &&
                          it.date <= seg.endDate,
                      )
                      .map((it) => it.id);
                    await Promise.all(
                      stayIds.map((id) => updateItineraryItem(id, { location_name: trimmed })),
                    );
                    toast.success(`Location set to "${trimmed}"`);
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t border-border px-3 py-2">
        {tripStart && newEnd && (
          <div className="font-inter text-[10px] text-muted-foreground">
            Trip window: {format(tripStart, "MMM d")} → {format(parseISO(newEnd), "MMM d, yyyy")}{" "}
            · {totalNights} night{totalNights === 1 ? "" : "s"}
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={(!orderChanged && !hasRemovals) || assignedRemaining === 0 || saving}
            title={assignedRemaining === 0 ? "A trip needs at least one location" : undefined}
          >
            {saving ? "Applying…" : hasRemovals ? "Apply changes" : "Apply reshuffle"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  segment: LocationSegment;
  index: number;
  total: number;
  preview: { start: string; end: string } | null;
  removed: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onRestore: () => void;
  items: ItineraryItem[];
  leg: LocationLeg | null;
  onRename: (label: string) => Promise<void> | void;
}

function ReshuffleRow({
  segment,
  index,
  total,
  preview,
  removed,
  onMove,
  onRemove,
  onRestore,
  items,
  leg,
  onRename,
}: RowProps) {
  const disabled = segment.isUnassigned;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Source of truth: the Matrix Grid leg label (city, state, country).
  // Falls back to any stay's location_name if no leg exists for this segment.
  const currentLabel = useMemo(() => {
    if (leg?.label && leg.label.trim()) return leg.label.trim();
    const stays = items.filter(
      (it) =>
        it.category === "stays" &&
        it.date &&
        it.date >= segment.startDate &&
        it.date <= segment.endDate,
    );
    const named = stays.find((s) => s.location_name && s.location_name.trim());
    return named?.location_name?.trim() ?? "";
  }, [leg, items, segment.startDate, segment.endDate]);

  // Hotel/stay names shown as subline context.
  const stayTitles = useMemo(() => {
    const stays = items.filter(
      (it) =>
        it.category === "stays" &&
        it.date &&
        it.date >= segment.startDate &&
        it.date <= segment.endDate,
    );
    return Array.from(new Set(stays.map((s) => s.title))).join(" · ");
  }, [items, segment.startDate, segment.endDate]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentLabel);
  useMemo(() => setDraft(currentLabel), [currentLabel]);

  const fmt = (iso: string) => format(parseISO(iso), "MMM d");
  const newStart = preview?.start ?? segment.startDate;
  const newEnd = preview?.end ?? segment.endDate;
  const dateLine =
    segment.nights === 1
      ? `${fmt(newStart)} · 1 night`
      : `${fmt(newStart)} → ${fmt(newEnd)} · ${segment.nights} nights`;
  const shifted = preview && preview.start !== segment.startDate;

  const commit = async () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== currentLabel) {
      await onRename(draft);
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-1 rounded-sm border border-border bg-card ${
        disabled ? "opacity-60" : ""
      } ${removed ? "opacity-50 line-through" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="flex w-8 cursor-grab items-center justify-center border-r border-border text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1 px-2 py-2 min-w-0">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-accent shrink-0" />
          {editing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(currentLabel);
                  setEditing(false);
                }
              }}
              placeholder="City, State, Country"
              className="h-6 px-1.5 py-0 font-playfair text-sm"
            />
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEditing(true)}
              className="group flex min-w-0 items-center gap-1 truncate text-left font-playfair text-sm text-foreground hover:text-accent disabled:cursor-default"
              title="Click to edit city / location"
            >
              <span className={`truncate ${!currentLabel ? "italic text-muted-foreground" : ""}`}>
                {currentLabel || "Set city, state, country"}
              </span>
              <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-60" />
            </button>
          )}
        </div>
        {stayTitles && (
          <div className="ml-4 truncate font-inter text-[9px] uppercase tracking-wide text-muted-foreground/70">
            {stayTitles}
          </div>
        )}
        <div className="mt-0.5 font-inter text-[10px] text-muted-foreground">
          {dateLine}
          {shifted && (
            <span className="ml-1 text-accent/80">(was {fmt(segment.startDate)})</span>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center gap-0.5 pr-1.5">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={disabled || removed || index === 0}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move up"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={disabled || removed || index === total - 1}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move down"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>

      {!disabled && (
        <div className="flex items-center pr-1.5">
          {removed ? (
            <button
              type="button"
              onClick={onRestore}
              className="rounded-sm px-1.5 py-0.5 font-inter text-[10px] text-accent hover:bg-accent/10"
              aria-label="Undo remove"
            >
              Undo
            </button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove location"
                  title="Remove this location"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this location?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Removing this location will delete its {segment.nights} night
                    {segment.nights === 1 ? "" : "s"} and every stay, dining, agenda and
                    logistics item scheduled within that window. Later locations will shift
                    earlier and the trip end date will shrink. This takes effect when you
                    press Apply.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </li>
  );
}