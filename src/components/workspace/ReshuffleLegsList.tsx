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
import { ArrowDown, ArrowUp, GripVertical, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildSegments, computeReorderPatches, type LocationSegment } from "@/lib/segments";
import type { ItineraryItem, Trip } from "@/stores/useTripStore";

interface Props {
  trip: Trip;
  items: ItineraryItem[];
  onApply: (patches: { id: string; date: string }[]) => Promise<void> | void;
  onClose: () => void;
}

export default function ReshuffleLegsList({ trip, items, onApply, onClose }: Props) {
  const baseSegments = useMemo(() => buildSegments(trip, items), [trip, items]);
  const [order, setOrder] = useState<LocationSegment[]>(baseSegments);
  const [saving, setSaving] = useState(false);

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

  // Live preview dates as if applied
  const preview = useMemo(() => {
    if (!trip.start_date) return new Map<string, { start: string; end: string }>();
    const ts = parseISO(trip.start_date);
    let cursor = 0;
    const m = new Map<string, { start: string; end: string }>();
    for (const seg of order) {
      const start = format(addDays(ts, cursor), "yyyy-MM-dd");
      const end = format(addDays(ts, cursor + seg.nights - 1), "yyyy-MM-dd");
      m.set(seg.id, { start, end });
      cursor += seg.nights;
    }
    return m;
  }, [order, trip.start_date]);

  const totalNights = order.reduce((sum, s) => sum + s.nights, 0);

  const handleApply = async () => {
    if (!orderChanged) {
      toast.message("Order unchanged.");
      return;
    }
    setSaving(true);
    const patches = computeReorderPatches(trip, order, items);
    await onApply(patches);
    setSaving(false);
    toast.success("Legs reshuffled");
    onClose();
  };

  if (baseSegments.length < 2) {
    return (
      <div className="p-4 font-inter text-xs text-muted-foreground">
        Add at least two location legs to reshuffle the trip.
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
        <div className="font-playfair text-sm text-foreground">Reshuffle legs</div>
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
                  onMove={(dir) => move(seg.id, dir)}
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
          <Button size="sm" onClick={handleApply} disabled={!orderChanged || saving}>
            {saving ? "Applying…" : "Apply reshuffle"}
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
  onMove: (dir: -1 | 1) => void;
}

function ReshuffleRow({ segment, index, total, preview, onMove }: RowProps) {
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

  const fmt = (iso: string) => format(parseISO(iso), "MMM d");
  const newStart = preview?.start ?? segment.startDate;
  const newEnd = preview?.end ?? segment.endDate;
  const dateLine =
    segment.nights === 1
      ? `${fmt(newStart)} · 1 night`
      : `${fmt(newStart)} → ${fmt(newEnd)} · ${segment.nights} nights`;
  const shifted = preview && preview.start !== segment.startDate;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-1 rounded-sm border border-border bg-card ${
        disabled ? "opacity-60" : ""
      }`}
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
          <span className="truncate font-playfair text-sm text-foreground">
            {segment.location}
          </span>
        </div>
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
          disabled={disabled || index === 0}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move up"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={disabled || index === total - 1}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move down"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}