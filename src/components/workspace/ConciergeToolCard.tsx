import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Wrench,
  XCircle,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ToolInvocation {
  name: string;
  args?: Record<string, unknown>;
  result?: any;
}

const TOOL_LABELS: Record<string, string> = {
  create_itinerary_item: "Added to itinerary",
  update_itinerary_item: "Updated itinerary item",
  delete_itinerary_item: "Removed itinerary item",
  get_trip_summary: "Reviewed trip summary",
  search_places: "Searched places",
  add_studio_item: "Saved to Studio",
};

function labelFor(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

function summaryFor(tc: ToolInvocation): string | null {
  const r = tc.result ?? {};
  const item = r.item ?? r.data ?? null;
  if (item?.title) {
    const bits = [item.title];
    if (item.date) bits.push(item.date);
    if (item.category) bits.push(item.category);
    return bits.join(" · ");
  }
  if (typeof r.count === "number") return `${r.count} result${r.count === 1 ? "" : "s"}`;
  if (typeof r.message === "string") return r.message;
  return null;
}

function isOk(tc: ToolInvocation): boolean {
  const r = tc.result ?? {};
  if (r.ok === false) return false;
  if (typeof r.error === "string") return false;
  return true;
}

export default function ConciergeToolCard({ tc }: { tc: ToolInvocation }) {
  const [open, setOpen] = useState(false);
  const ok = isOk(tc);
  const summary = summaryFor(tc);
  const errorMsg = tc.result?.error;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-[2px] border bg-background/60 text-[11px]",
          ok ? "border-border" : "border-destructive/40",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left font-inter hover:bg-muted/40"
          >
            {ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" strokeWidth={1.5} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                <Wrench className="mr-1 inline h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                {labelFor(tc.name)}
              </p>
              {summary && (
                <p className="truncate text-[10px] text-muted-foreground">{summary}</p>
              )}
              {!ok && errorMsg && (
                <p className="truncate text-[10px] text-destructive">{String(errorMsg)}</p>
              )}
            </div>
            {open ? (
              <ChevronDown className="mt-0.5 h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-0.5 h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/60 bg-muted/30 px-2.5 py-2">
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-muted-foreground">
            {JSON.stringify({ args: tc.args, result: tc.result }, null, 2)}
          </pre>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}