import { format, parseISO } from "date-fns";
import { Trash2, ArrowRightToLine } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTripStore } from "@/stores/useTripStore";
import type { ItineraryItem } from "@/stores/useTripStore";
import { clampDateToTrip } from "@/lib/segments";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orphans: ItineraryItem[];
}

export default function OrphanItemsSheet({ open, onOpenChange, orphans }: Props) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const updateItem = useTripStore((s) => s.updateItineraryItem);
  const deleteItem = useTripStore((s) => s.deleteItineraryItem);

  const handleMove = async (item: ItineraryItem) => {
    if (!activeTrip || !item.date) return;
    const newDate = clampDateToTrip(activeTrip, item.date);
    await updateItem(item.id, { date: newDate });
    toast.success(`Moved "${item.title}" to ${format(parseISO(newDate), "MMM d")}`);
  };

  const handleDelete = async (item: ItineraryItem) => {
    await deleteItem(item.id);
    toast.success(`Deleted "${item.title}"`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle className="font-playfair text-lg">Items outside trip</SheetTitle>
          <SheetDescription className="font-inter text-xs text-muted-foreground">
            These items have dates that fall outside your trip's current window. Move them to the
            nearest in-window day or delete them.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {orphans.length === 0 && (
            <div className="rounded-sm border border-border bg-card px-3 py-6 text-center font-inter text-xs text-muted-foreground">
              No orphan items.
            </div>
          )}
          {orphans.map((item) => (
            <div
              key={item.id}
              className="rounded-sm border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-inter text-xs font-medium text-foreground">
                    {item.title}
                  </div>
                  <div className="mt-0.5 font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
                    {item.category}
                    {item.date && (
                      <> · {format(parseISO(item.date), "MMM d, yyyy")}</>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 font-inter text-[11px]"
                  onClick={() => handleMove(item)}
                >
                  <ArrowRightToLine className="h-3 w-3" />
                  Move into window
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 font-inter text-[11px] text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}