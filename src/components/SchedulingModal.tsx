import { useState, useEffect } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { CheckCircle2, Globe } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/useTripStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM",
];

// TODO: detect via Intl.DateTimeFormat().resolvedOptions().timeZone
const DEFAULT_TZ = "America/Los_Angeles";
const TZ_LABEL = "PST";
const TZ_CITY = "Los Angeles";

/** Deterministic dummy availability — generated once at module load. */
function buildAvailability(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const today = startOfDay(new Date());
  // Variations of slot subsets for realism
  const MORNING = TIME_SLOTS.slice(0, 6);            // 9–11:30
  const AFTERNOON = TIME_SLOTS.slice(8, 15);         // 1–4
  const FULL = TIME_SLOTS;
  const LIMITED_A = ["10:00 AM", "2:30 PM"];
  const LIMITED_B = ["9:30 AM", "11:00 AM", "3:00 PM"];
  const MID = ["10:30 AM", "11:00 AM", "1:00 PM", "1:30 PM", "2:00 PM"];
  const patterns = [MORNING, AFTERNOON, FULL, LIMITED_A, MID, AFTERNOON, LIMITED_B, FULL, MORNING, MID];

  let p = 0;
  for (let i = 1; i <= 45; i++) {
    const d = addDays(today, i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;           // skip weekends
    if (i % 7 === 3) continue;                       // skip a few weekdays for realism
    if (i % 11 === 0) continue;
    const key = format(d, "yyyy-MM-dd");
    map[key] = patterns[p % patterns.length];
    p++;
  }
  return map;
}

const AVAILABILITY = buildAvailability();
const AVAILABLE_DATES = Object.keys(AVAILABILITY).map((k) => new Date(k + "T00:00:00"));
const AVAILABILITY_UPDATED_AT = format(new Date(), "MMM d, h:mm a");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: {
    tripId?: string | null;
    agenda?: string;
  };
}

export default function SchedulingModal({ open, onOpenChange, prefill }: Props) {
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [agenda, setAgenda] = useState("");
  const [tripId, setTripId] = useState<string>("none");
  const trips = useTripStore((s) => s.trips);
  const selectedTrip = trips.find((t) => t.id === tripId) ?? null;
  const addAppointment = useTripStore((s) => s.addAppointment);

  useEffect(() => {
    if (open && prefill) {
      if (prefill.agenda) setAgenda(prefill.agenda);
      if (prefill.tripId) setTripId(prefill.tripId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dateKey = date ? format(date, "yyyy-MM-dd") : null;
  const slotsForDate = dateKey ? AVAILABILITY[dateKey] ?? [] : [];

  const handleConfirm = () => {
    const contextSuffix = selectedTrip
      ? ` · linked to ${selectedTrip.name}.`
      : ` · exploratory session.`;
    addAppointment({
      date: dateKey!,
      slot: slot!,
      timezone_label: TZ_LABEL,
      trip_id: selectedTrip?.id ?? null,
      trip_name: selectedTrip?.name ?? null,
      agenda,
    });
    toast({
      title: "Request Sent",
      description: `Concierge session on ${format(date!, "MMM d, yyyy")} at ${slot} ${TZ_LABEL}${contextSuffix}`,
    });
    setDate(undefined);
    setSlot(null);
    setAgenda("");
    setTripId("none");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-playfair text-lg font-semibold text-foreground">
                Plan w/ Concierge
              </DialogTitle>
              <DialogDescription className="font-inter text-xs text-muted-foreground">
                Book a 30-minute planning session. Availability updated hourly.
              </DialogDescription>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 border-thin border-accent/40 px-2.5 py-1 rounded-[2px] text-accent">
              <Globe className="h-3 w-3" strokeWidth={1.5} />
              <span className="font-inter text-[10px] uppercase tracking-wider">
                Times in {TZ_LABEL} · {TZ_CITY}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Col 1 — Calendar */}
          <div className="flex flex-col items-center p-4 gap-2">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { setDate(d); setSlot(null); }}
              disabled={(d) => d < startOfDay(new Date()) || !AVAILABILITY[format(d, "yyyy-MM-dd")]}
              modifiers={{ available: AVAILABLE_DATES }}
              modifiersClassNames={{
                available: "text-accent font-medium underline decoration-accent/60 decoration-1 underline-offset-4",
              }}
              className="p-3 pointer-events-auto"
            />
            <p className="font-inter text-[10px] text-muted-foreground">
              Availability synced {AVAILABILITY_UPDATED_AT}
            </p>
          </div>

          {/* Col 2 — Time Slots */}
          <div className="p-4 overflow-y-auto max-h-80">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-inter text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {date ? `${format(date, "EEE, MMM d")} · ${TZ_LABEL}` : "Select a date"}
              </p>
              {date && slotsForDate.length > 0 && slotsForDate.length <= 3 && (
                <span className="font-inter text-[10px] uppercase tracking-wider text-accent">
                  Limited
                </span>
              )}
            </div>
            {date ? (
              slotsForDate.length === 0 ? (
                <p className="font-inter text-xs text-muted-foreground">No availability on this date.</p>
              ) : (
              <div className="flex flex-col gap-1">
                {slotsForDate.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSlot(t)}
                    className={cn(
                      "rounded-sm px-3 py-2 text-left font-inter text-xs transition-colors",
                      slot === t
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {t} <span className="text-muted-foreground/70">{TZ_LABEL}</span>
                  </button>
                ))}
              </div>
              )
            ) : (
              <p className="font-inter text-xs text-muted-foreground">Pick a date to see times.</p>
            )}
          </div>

          {/* Col 3 — Agenda */}
          <div className="flex flex-col justify-between p-4 gap-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-inter text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Trip Context
                </label>
                <Select value={tripId} onValueChange={setTripId}>
                  <SelectTrigger className="font-inter text-sm">
                    <SelectValue placeholder="Select trip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="font-inter text-sm">No trip — exploratory ideation</span>
                    </SelectItem>
                    {trips.map((t) => {
                      const sub = [
                        t.destination,
                        t.start_date && t.end_date
                          ? `${format(new Date(t.start_date), "MMM d")} – ${format(new Date(t.end_date), "MMM d")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex flex-col">
                            <span className="font-inter text-sm">{t.name}</span>
                            {sub && (
                              <span className="font-inter text-[10px] text-muted-foreground">{sub}</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className={cn(
                  "font-inter text-[10px]",
                  selectedTrip ? "text-accent" : "text-muted-foreground"
                )}>
                  {selectedTrip
                    ? "Concierge will have live view-access to this trip during the call."
                    : "The concierge will help you brainstorm from scratch."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-inter text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Appointment Agenda
                </label>
                <Textarea
                  placeholder="What would you like to plan?"
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  className="min-h-[100px] font-inter text-sm resize-none"
                />
              </div>
            </div>

            <Button
              disabled={!date || !slot}
              onClick={handleConfirm}
              className="w-full gap-2 bg-accent text-accent-foreground font-inter text-sm hover:bg-accent/90"
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
