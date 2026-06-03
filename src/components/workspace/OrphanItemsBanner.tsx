import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTripStore } from "@/stores/useTripStore";
import { findOrphanedItems } from "@/lib/segments";
import OrphanItemsSheet from "./OrphanItemsSheet";

export default function OrphanItemsBanner() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const items = useTripStore((s) => s.itineraryItems);
  const [open, setOpen] = useState(false);

  const orphans = useMemo(
    () => findOrphanedItems(activeTrip, items),
    [activeTrip, items],
  );

  if (!activeTrip || orphans.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 border-y border-border bg-accent/15 px-3 py-2 text-left transition-colors hover:bg-accent/25"
      >
        <span className="flex items-center gap-2 font-inter text-[11px] text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-accent" />
          {orphans.length} item{orphans.length === 1 ? "" : "s"} outside the trip window
        </span>
        <span className="font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
          Review
        </span>
      </button>
      <OrphanItemsSheet open={open} onOpenChange={setOpen} orphans={orphans} />
    </>
  );
}