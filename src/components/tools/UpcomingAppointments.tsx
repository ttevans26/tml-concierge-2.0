import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, Globe, Link2, Sparkles, X, Plus } from "lucide-react";
import { useTripStore } from "@/stores/useTripStore";
import { Button } from "@/components/ui/button";
import SchedulingModal from "@/components/SchedulingModal";
import { toast } from "sonner";

/** Convert "10:30 AM" -> sortable 24h string like "10:30" */
function slotSortKey(slot: string): string {
  const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return slot;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const mer = m[3].toUpperCase();
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

export default function UpcomingAppointments() {
  const appointments = useTripStore((s) => s.appointments);
  const cancel = useTripStore((s) => s.cancelAppointment);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...appointments]
      .filter((a) => a.date >= today)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return slotSortKey(a.slot) < slotSortKey(b.slot) ? -1 : 1;
      });
  }, [appointments]);

  const handleCancel = (id: string) => {
    cancel(id);
    toast.success("Appointment cancelled");
  };

  return (
    <>
      <section className="mb-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="font-inter text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-2">
              Concierge
            </p>
            <h2 className="font-playfair text-2xl md:text-3xl text-foreground">
              Upcoming Sessions
            </h2>
          </div>
          <Button
            onClick={() => setScheduleOpen(true)}
            variant="outline"
            className="gap-2 border-thin border-accent/60 text-accent hover:bg-accent/5 hover:text-accent rounded-sm"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="font-inter text-xs">Schedule</span>
          </Button>
        </div>

        {upcoming.length === 0 ? (
          <div className="border-thin border-foreground/20 rounded-sm p-8 text-center">
            <CalendarClock className="h-5 w-5 mx-auto mb-3 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-playfair italic text-foreground/70 mb-1">
              No upcoming sessions.
            </p>
            <p className="font-inter text-xs text-muted-foreground mb-4">
              Book a 30-minute planning session with our travel concierge.
            </p>
            <Button
              onClick={() => setScheduleOpen(true)}
              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-inter text-xs"
            >
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} />
              Plan w/ Concierge
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map((appt) => {
              const d = parseISO(appt.date);
              return (
                <article
                  key={appt.id}
                  className="group flex items-stretch gap-4 border-thin border-foreground/20 rounded-sm p-4 bg-background hover:border-accent/50 transition-colors"
                >
                  {/* Date block */}
                  <div className="flex flex-col items-center justify-center min-w-[64px] border-r-thin border-foreground/15 pr-4">
                    <p className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
                      {format(d, "EEE")}
                    </p>
                    <p className="font-playfair text-3xl text-foreground leading-none my-1">
                      {format(d, "d")}
                    </p>
                    <p className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
                      {format(d, "MMM")}
                    </p>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col flex-1 min-w-0 gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-inter text-sm font-medium text-foreground">
                          {appt.slot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-accent">
                          <Globe className="h-3 w-3" strokeWidth={1.5} />
                          <span className="font-inter text-[10px] uppercase tracking-wider">
                            {appt.timezone_label}
                          </span>
                        </span>
                      </div>
                      <button
                        onClick={() => handleCancel(appt.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                        aria-label="Cancel appointment"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>

                    {appt.agenda && (
                      <p className="font-inter text-xs text-muted-foreground line-clamp-2">
                        {appt.agenda}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-auto pt-1">
                      {appt.trip_name ? (
                        <>
                          <Link2 className="h-3 w-3 text-accent" strokeWidth={1.5} />
                          <span className="font-inter text-[11px] text-accent truncate">
                            Linked to {appt.trip_name}
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                          <span className="font-inter text-[11px] text-muted-foreground">
                            Exploratory session
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <SchedulingModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </>
  );
}