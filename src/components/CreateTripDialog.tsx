import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Minus, Plus, X, AlertTriangle } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
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
import PlaceAutocomplete from "@/components/ui/PlaceAutocomplete";

interface CreateTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CityRow {
  id: string;
  name: string;
  nights: number;
  city: string;
  state: string | null;
  country: string | null;
  googlePlaceId: string | null;
}

function SortableCity({
  city,
  onNights,
  onRemove,
}: {
  city: CityRow;
  onNights: (n: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: city.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-sm border border-border bg-background px-2 py-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder city"
        className="flex h-9 w-7 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0 truncate font-inter text-sm text-foreground">
        {city.name}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onNights(Math.max(1, city.nights - 1))}
          aria-label="Decrease nights"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground"
        >
          <Minus className="h-3 w-3" />
        </button>
        <div className="min-w-[3.5rem] text-center font-inter text-xs uppercase tracking-widest text-muted-foreground">
          {city.nights} {city.nights === 1 ? "night" : "nights"}
        </div>
        <button
          type="button"
          onClick={() => onNights(city.nights + 1)}
          aria-label="Increase nights"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove city"
        className="flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function CreateTripDialog({ open, onOpenChange }: CreateTripDialogProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [cities, setCities] = useState<CityRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const createTrip = useTripStore((s) => s.createTrip);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const tripNights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    try {
      const d = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
      return Math.max(0, d);
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  const plannedNights = cities.reduce((s, c) => s + c.nights, 0);
  const hasMismatch = tripNights > 0 && cities.length > 0 && plannedNights !== tripNights;

  const addCity = () => {
    const v = cityInput.trim();
    if (!v) return;
    setCities((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: v,
        nights: 1,
        city: v,
        state: null,
        country: null,
        googlePlaceId: null,
      },
    ]);
    setCityInput("");
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setCities((prev) => {
      const oldIdx = prev.findIndex((c) => c.id === active.id);
      const newIdx = prev.findIndex((c) => c.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const reset = () => {
    setName("");
    setCityInput("");
    setCities([]);
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    const destinationText = cities.map((c) => c.name).join(", ") || null;
    const seedStays =
      startDate && endDate && cities.length
        ? cities.map((c) => ({ city: c.city, nights: c.nights }))
        : undefined;
    const seedLocations =
      startDate && endDate && cities.length
        ? cities.map((c) => ({
            city: c.city,
            state: c.state,
            country: c.country,
            googlePlaceId: c.googlePlaceId,
            nights: c.nights,
          }))
        : undefined;
    await createTrip(
      {
        name: name.trim(),
        destination: destinationText,
        start_date: startDate || null,
        end_date: endDate || null,
      },
      { seedStays, seedLocations },
    );
    setSubmitting(false);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-thin border-border bg-card sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

          <div className="space-y-2">
            <Label className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
              Destinations
            </Label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1">
                <PlaceAutocomplete
                  id="destination"
                  value={cityInput}
                  onChange={setCityInput}
                  onSelect={(p) => {
                    const main = p.mainText || p.description.split(",")[0].trim();
                    const parts = (p.secondaryText || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    let state: string | null = null;
                    let country: string | null = null;
                    if (parts.length === 1) country = parts[0];
                    else if (parts.length >= 2) {
                      state = parts[0];
                      country = parts[parts.length - 1];
                    }
                    setCities((prev) => [
                      ...prev,
                      {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        name: p.description,
                        nights: 1,
                        city: main,
                        state,
                        country,
                        googlePlaceId: p.placeId,
                      },
                    ]);
                    setCityInput("");
                  }}
                  placeholder="Search a city…"
                  types="cities"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addCity}
                disabled={!cityInput.trim()}
                className="font-inter text-sm"
              >
                Add
              </Button>
            </div>

            {cities.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={cities.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {cities.map((c) => (
                      <SortableCity
                        key={c.id}
                        city={c}
                        onNights={(n) =>
                          setCities((prev) => prev.map((x) => (x.id === c.id ? { ...x, nights: n } : x)))
                        }
                        onRemove={() => setCities((prev) => prev.filter((x) => x.id !== c.id))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {cities.length > 0 && tripNights > 0 && (
              <div className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                {plannedNights} of {tripNights} {tripNights === 1 ? "night" : "nights"} planned
              </div>
            )}

            {hasMismatch && (
              <div className="flex items-start gap-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 font-inter text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Your city stays add up to {plannedNights} {plannedNights === 1 ? "night" : "nights"} but the trip is{" "}
                  {tripNights} {tripNights === 1 ? "night" : "nights"}. You can continue — adjust later in the workspace.
                </span>
              </div>
            )}
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
