import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { GripVertical, MapPin, MoreVertical, ArrowUpToLine, ArrowDownToLine } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationSegment } from "@/lib/segments";

interface Props {
  segment: LocationSegment;
  index: number;
  total: number;
  onMoveToStart: (id: string) => void;
  onMoveToEnd: (id: string) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  stays: "Stays",
  dining: "Dining",
  activity: "Activities",
  logistics: "Logistics",
  sites_of_interest: "Sites",
};

export default function SegmentCard({ segment, index, total, onMoveToStart, onMoveToEnd }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const startLabel = format(parseISO(segment.startDate), "MMM d");
  const endLabel = format(parseISO(segment.endDate), "MMM d");
  const dateRange =
    segment.startDate === segment.endDate ? startLabel : `${startLabel} → ${endLabel}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-2 rounded-sm border border-border bg-card ${
        segment.isUnassigned ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex w-9 cursor-grab items-center justify-center border-r border-border text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 px-2 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-accent" />
              <span className="truncate font-playfair text-sm text-foreground">
                {segment.location}
              </span>
            </div>
            <div className="mt-0.5 font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
              {dateRange} · {segment.nights} night{segment.nights === 1 ? "" : "s"}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Segment actions"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-inter text-xs">
              <DropdownMenuItem
                disabled={index === 0}
                onClick={() => onMoveToStart(segment.id)}
              >
                <ArrowUpToLine className="mr-2 h-3 w-3" />
                Move to start
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === total - 1}
                onClick={() => onMoveToEnd(segment.id)}
              >
                <ArrowDownToLine className="mr-2 h-3 w-3" />
                Move to end
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {Object.keys(segment.counts).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(segment.counts).map(([cat, count]) => (
              <span
                key={cat}
                className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 font-inter text-[10px] text-muted-foreground"
              >
                {count} {CATEGORY_LABEL[cat] ?? cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}