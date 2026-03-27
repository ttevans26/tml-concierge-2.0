import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
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

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SchedulingModal({ open, onOpenChange }: Props) {
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [agenda, setAgenda] = useState("");

  const handleConfirm = () => {
    toast({
      title: "Request Sent",
      description: `Concierge session on ${format(date!, "MMM d, yyyy")} at ${slot}.`,
    });
    setDate(undefined);
    setSlot(null);
    setAgenda("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-playfair text-lg font-semibold text-foreground">
            Plan w/ Concierge
          </DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            Book a 30-minute planning session with our travel concierge.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Col 1 — Calendar */}
          <div className="flex items-start justify-center p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { setDate(d); setSlot(null); }}
              disabled={(d) => d < new Date()}
              className="p-3 pointer-events-auto"
            />
          </div>

          {/* Col 2 — Time Slots */}
          <div className="p-4 overflow-y-auto max-h-80">
            <p className="mb-3 font-inter text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {date ? format(date, "EEE, MMM d") : "Select a date"}
            </p>
            {date ? (
              <div className="flex flex-col gap-1">
                {TIME_SLOTS.map((t) => (
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
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <p className="font-inter text-xs text-muted-foreground">Pick a date to see times.</p>
            )}
          </div>

          {/* Col 3 — Agenda */}
          <div className="flex flex-col justify-between p-4 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-inter text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Appointment Agenda
              </label>
              <Textarea
                placeholder="What would you like to plan?"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                className="min-h-[140px] font-inter text-sm resize-none"
              />
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
