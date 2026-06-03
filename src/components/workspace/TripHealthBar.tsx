import { useMemo, useState } from "react";
import { useTripStore } from "@/stores/useTripStore";
import { detectGaps, computeHealthScore, type Gap } from "@/lib/gapDetection";
import { AlertCircle, Sparkles, ChevronDown, ChevronUp, CheckCircle2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import EditItemDialog from "@/components/workspace/EditItemDialog";
import type { ItineraryItem } from "@/stores/useTripStore";
import { toast } from "@/hooks/use-toast";
import SchedulingModal from "@/components/SchedulingModal";
import { CalendarClock } from "lucide-react";

interface TripHealthBarProps {
  onAskConcierge?: (prompt: string) => void;
}

const SEVERITY_TONE: Record<Gap["severity"], string> = {
  high: "text-destructive border-destructive/30 bg-destructive/5",
  medium: "text-[hsl(var(--accent-bronze))] border-[hsl(var(--accent-bronze))]/30 bg-[hsl(var(--accent-bronze))]/5",
  low: "text-muted-foreground border-border bg-muted/30",
};

export default function TripHealthBar({ onAskConcierge }: TripHealthBarProps) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const items = useTripStore((s) => s.itineraryItems);
  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const [open, setOpen] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ItineraryItem | null>(null);
  const [schedule, setSchedule] = useState<{ open: boolean; agenda: string }>({
    open: false,
    agenda: "",
  });

  const { score, gaps } = useMemo(() => {
    return {
      score: computeHealthScore(activeTrip, items),
      gaps: detectGaps(activeTrip, items),
    };
  }, [activeTrip, items]);

  if (!activeTrip?.start_date) return null;

  const handleCreateFromGap = async (g: Gap) => {
    if (!activeTrip) return;
    setCreatingId(g.id);
    const created = await createItineraryItem({
      trip_id: activeTrip.id,
      title: g.seed.title,
      category: g.seed.category,
      date: g.date,
      location_name: g.seed.location_name ?? null,
      approval_status: "draft",
    });
    setCreatingId(null);
    if (created) {
      toast({ title: "Draft added", description: g.seed.title });
      setEditItem(created);
    }
  };

  const gapCount = gaps.length;
  const allGood = gapCount === 0;

  return (
    <div className="border-b border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          {allGood ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-[hsl(var(--accent-bronze))]" />
          )}
          <span className="font-inter text-[12px] font-medium text-foreground">
            {score}% planned
          </span>
        </div>

        <div className="h-1.5 flex-1 min-w-[120px] max-w-xs overflow-hidden rounded-sm bg-muted">
          <div
            className="h-full bg-[hsl(var(--accent-bronze))] transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>

        <span className="font-inter text-[11px] text-muted-foreground">
          {allGood ? "No gaps detected" : `${gapCount} gap${gapCount === 1 ? "" : "s"} to resolve`}
        </span>

        {!allGood && (
          <span className="ml-auto text-muted-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </button>

      {open && !allGood && (
        <div className="border-t border-border/60 bg-background/60 px-4 py-3">
          <ul className="space-y-1.5">
            {gaps.slice(0, 8).map((g) => (
              <li
                key={g.id}
                className={`flex items-center gap-3 rounded-sm border-[0.5px] px-2.5 py-1.5 ${SEVERITY_TONE[g.severity]}`}
              >
                <span className="font-inter text-[10px] uppercase tracking-wider opacity-70 w-20 shrink-0">
                  {format(parseISO(g.date), "EEE MMM d")}
                </span>
                <span className="font-inter text-[12px] font-medium">{g.label}</span>
                <span className="font-inter text-[11px] opacity-75 truncate">{g.detail}</span>
                {onAskConcierge && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 gap-1 px-2 font-inter text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAskConcierge(g.prompt);
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Ask concierge
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${onAskConcierge ? "" : "ml-auto"} h-7 gap-1 px-2 font-inter text-[11px]`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSchedule({ open: true, agenda: g.prompt });
                  }}
                  title="Book a planning session"
                >
                  <CalendarClock className="h-3 w-3" />
                  Schedule
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 font-inter text-[11px]"
                  disabled={creatingId === g.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateFromGap(g);
                  }}
                >
                  {creatingId === g.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Create draft
                </Button>
              </li>
            ))}
            {gaps.length > 8 && (
              <li className="font-inter text-[11px] text-muted-foreground pl-2">
                + {gaps.length - 8} more gaps
              </li>
            )}
          </ul>
        </div>
      )}
      {editItem && (
        <EditItemDialog
          open={!!editItem}
          onOpenChange={(o) => !o && setEditItem(null)}
          item={editItem}
        />
      )}
      <SchedulingModal
        open={schedule.open}
        onOpenChange={(o) => setSchedule((s) => ({ ...s, open: o }))}
        prefill={{ tripId: activeTrip?.id, agenda: schedule.agenda }}
      />
    </div>
  );
}