import { lazy, Suspense, useState } from "react";
import {
  CalendarOff,
  CreditCard,
  Route,
  Wallet,
  UtensilsCrossed,
  Sun,
  Plane,
  Loader2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/useTripStore";
import { toast } from "@/hooks/use-toast";

const ReactMarkdown = lazy(() => import("react-markdown"));

/* --------------------------------------------------------------- */

export interface Proposal {
  type: string;
  [k: string]: unknown;
}

export function getProposal(result: unknown): Proposal | null {
  if (!result || typeof result !== "object") return null;
  const p = (result as { proposal?: unknown }).proposal;
  if (!p || typeof p !== "object") return null;
  if (typeof (p as { type?: unknown }).type !== "string") return null;
  return p as Proposal;
}

/* --------------------------------------------------------------- */

const HEADER_STYLES =
  "flex items-center gap-1.5 border-b border-border/60 px-2.5 py-1.5 font-inter text-[10px] uppercase tracking-wider text-muted-foreground";
const CARD_STYLES = "rounded-[2px] border border-border bg-background overflow-hidden";

/* ============================================================
 *  Dispatcher
 * ============================================================ */
export default function ProposalCard({ proposal }: { proposal: Proposal }) {
  switch (proposal.type) {
    case "find_gaps":
      return <FindGapsCard p={proposal as any} />;
    case "optimize_loyalty":
      return <LoyaltyCard p={proposal as any} />;
    case "optimize_route":
      return <RouteCard p={proposal as any} />;
    case "rebalance_budget":
      return <BudgetCard p={proposal as any} />;
    case "find_dining_near_anchor":
      return <DiningCard p={proposal as any} />;
    case "summarize_day":
      return <SummarizeDayCard p={proposal as any} />;
    case "suggest_logistics":
      return <LogisticsCard p={proposal as any} />;
    default:
      return null;
  }
}

/* ============================================================
 *  1. find_gaps
 * ============================================================ */
function FindGapsCard({ p }: { p: { total_days: number; gaps: { date: string; type: string; note: string }[] } }) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const create = useTripStore((s) => s.createItineraryItem);
  const fetchItems = useTripStore((s) => s.fetchItineraryItems);
  const [adding, setAdding] = useState<string | null>(null);

  if (p.gaps.length === 0) {
    return (
      <div className={CARD_STYLES}>
        <div className={HEADER_STYLES}>
          <CheckCircle2 className="h-3 w-3 text-accent" strokeWidth={1.75} /> No gaps found
        </div>
        <p className="px-2.5 py-2 font-inter text-[11px] text-muted-foreground">
          All {p.total_days} days have at least one item scheduled.
        </p>
      </div>
    );
  }

  async function quickFill(date: string, type: string) {
    if (!activeTrip) return;
    setAdding(`${date}-${type}`);
    const title =
      type === "no_stay" ? "Stay — TBD" : type === "missing_dinner" ? "Dinner — TBD" : "Plan something here";
    const category: "stays" | "dining" | "activity" = type === "no_stay" ? "stays" : type === "missing_dinner" ? "dining" : "activity";
    const item = await create({
      trip_id: activeTrip.id,
      title,
      category,
      date,
      approval_status: "draft",
    });
    setAdding(null);
    if (item) {
      toast({ title: "Draft added", description: `${title} · ${date}` });
      fetchItems(activeTrip.id);
    }
  }

  return (
    <div className={CARD_STYLES}>
      <div className={HEADER_STYLES}>
        <CalendarOff className="h-3 w-3 text-accent" strokeWidth={1.75} /> {p.gaps.length} gap{p.gaps.length === 1 ? "" : "s"} across {p.total_days} days
      </div>
      <ul className="divide-y divide-border/40">
        {p.gaps.slice(0, 10).map((g) => {
          const key = `${g.date}-${g.type}`;
          return (
            <li key={key} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="font-inter text-[11px] font-medium text-foreground">{g.date}</p>
                <p className="font-inter text-[10px] text-muted-foreground">{g.note}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!activeTrip || adding === key}
                onClick={() => quickFill(g.date, g.type)}
                className="h-6 shrink-0 gap-1 rounded-[2px] font-inter text-[10px]"
              >
                {adding === key ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add draft"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================
 *  2. optimize_loyalty
 * ============================================================ */
function LoyaltyCard({
  p,
}: {
  p: {
    category: string;
    cost: number;
    currency: string;
    recommended: { card: string; multiplier: number; rationale: string; est_points: number } | null;
    alternatives: { card: string; multiplier: number; est_points: number }[];
  };
}) {
  if (!p.recommended) {
    return (
      <div className={CARD_STYLES}>
        <div className={HEADER_STYLES}>
          <CreditCard className="h-3 w-3 text-accent" strokeWidth={1.75} /> Loyalty pick
        </div>
        <p className="px-2.5 py-2 font-inter text-[11px] text-muted-foreground">
          No active cards on file. Add cards in Settings → Travel preferences.
        </p>
      </div>
    );
  }
  return (
    <div className={CARD_STYLES}>
      <div className={HEADER_STYLES}>
        <CreditCard className="h-3 w-3 text-accent" strokeWidth={1.75} /> Best card · {p.category}
      </div>
      <div className="space-y-1 px-2.5 py-2">
        <p className="font-inter text-[12px] font-medium text-foreground">{p.recommended.card}</p>
        <p className="font-inter text-[10px] text-muted-foreground">{p.recommended.rationale}</p>
        <p className="font-inter text-[11px] text-accent">
          {p.recommended.multiplier}× · ~{p.recommended.est_points.toLocaleString()} pts on {p.currency} {p.cost.toLocaleString()}
        </p>
      </div>
      {p.alternatives.length > 0 && (
        <ul className="border-t border-border/60 px-2.5 py-1.5 space-y-0.5">
          {p.alternatives.slice(0, 3).map((a) => (
            <li key={a.card} className="flex justify-between font-inter text-[10px] text-muted-foreground">
              <span>{a.card}</span>
              <span>{a.multiplier}× · {a.est_points.toLocaleString()} pts</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================
 *  3. optimize_route
 * ============================================================ */
function RouteCard({
  p,
}: {
  p: {
    date: string;
    sequence: { item_id: string; title: string; location_name: string | null; distance_km: number; transit_minutes: number }[];
    skipped_items: { id: string; title: string }[];
  };
}) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const fetchItems = useTripStore((s) => s.fetchItineraryItems);
  const [applying, setApplying] = useState(false);

  async function applyOrder() {
    if (!activeTrip || p.sequence.length === 0) return;
    setApplying(true);
    // Re-sequence start_times in 90-minute blocks beginning at 09:00.
    const { supabase } = await import("@/integrations/supabase/client");
    let startMin = 9 * 60;
    for (const step of p.sequence) {
      const h = Math.floor(startMin / 60).toString().padStart(2, "0");
      const m = (startMin % 60).toString().padStart(2, "0");
      await supabase
        .from("itinerary_items")
        .update({ start_time: `${h}:${m}:00` })
        .eq("id", step.item_id);
      startMin += 90 + step.transit_minutes;
    }
    await fetchItems(activeTrip.id);
    setApplying(false);
    toast({ title: "Day re-ordered", description: `${p.sequence.length} items resequenced.` });
  }

  return (
    <div className={CARD_STYLES}>
      <div className={HEADER_STYLES}>
        <Route className="h-3 w-3 text-accent" strokeWidth={1.75} /> Optimised route · {p.date}
      </div>
      <ol className="divide-y divide-border/40">
        {p.sequence.map((s, i) => (
          <li key={s.item_id} className="flex items-start gap-2 px-2.5 py-1.5">
            <span className="mt-0.5 font-inter text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <p className="font-inter text-[11px] text-foreground truncate">{s.title}</p>
              {s.location_name && <p className="font-inter text-[10px] text-muted-foreground truncate">{s.location_name}</p>}
            </div>
            <span className="font-inter text-[10px] text-muted-foreground whitespace-nowrap">
              {i === 0 ? "start" : `${s.distance_km} km · ${s.transit_minutes} min`}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between border-t border-border/60 px-2.5 py-1.5">
        {p.skipped_items.length > 0 ? (
          <span className="font-inter text-[10px] text-muted-foreground">
            {p.skipped_items.length} skipped (no coords)
          </span>
        ) : <span />}
        <Button
          size="sm"
          variant="outline"
          disabled={!activeTrip || applying}
          onClick={applyOrder}
          className="h-6 gap-1 rounded-[2px] font-inter text-[10px]"
        >
          {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
          Apply order
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
 *  4. rebalance_budget
 * ============================================================ */
function BudgetCard({
  p,
}: {
  p: {
    currency: string;
    nights: number;
    total_budget: number;
    total_spent: number;
    remaining: number;
    breakdown: { category: string; spent: number; allocation: number; over_by: number; status: "over" | "under" | "on_track" }[];
  };
}) {
  return (
    <div className={CARD_STYLES}>
      <div className={HEADER_STYLES}>
        <Wallet className="h-3 w-3 text-accent" strokeWidth={1.75} /> Budget rebalance · {p.nights} night{p.nights === 1 ? "" : "s"}
      </div>
      <div className="grid grid-cols-3 border-b border-border/60 text-center">
        <div className="border-r border-border/60 py-1.5">
          <p className="font-inter text-[9px] uppercase tracking-wider text-muted-foreground">Budget</p>
          <p className="font-inter text-[11px] font-medium text-foreground">{p.currency} {p.total_budget.toLocaleString()}</p>
        </div>
        <div className="border-r border-border/60 py-1.5">
          <p className="font-inter text-[9px] uppercase tracking-wider text-muted-foreground">Spent</p>
          <p className="font-inter text-[11px] font-medium text-foreground">{p.currency} {p.total_spent.toLocaleString()}</p>
        </div>
        <div className="py-1.5">
          <p className="font-inter text-[9px] uppercase tracking-wider text-muted-foreground">Remaining</p>
          <p className={cn("font-inter text-[11px] font-medium", p.remaining < 0 ? "text-destructive" : "text-accent")}>
            {p.currency} {p.remaining.toLocaleString()}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border/40">
        {p.breakdown.map((b) => (
          <li key={b.category} className="flex items-center justify-between px-2.5 py-1.5">
            <span className="font-inter text-[11px] text-foreground capitalize">{b.category.replace(/_/g, " ")}</span>
            <span
              className={cn(
                "font-inter text-[10px]",
                b.status === "over" && "text-destructive",
                b.status === "under" && "text-muted-foreground",
                b.status === "on_track" && "text-accent",
              )}
            >
              {b.spent.toLocaleString()} / {b.allocation.toLocaleString()} {b.status === "over" ? `(+${b.over_by.toLocaleString()})` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
 *  5. find_dining_near_anchor
 * ============================================================ */
function DiningCard({
  p,
}: {
  p: {
    anchor: { title: string; location_name: string | null };
    radius_km: number;
    candidates: { studio_item_id: string; title: string; address: string | null; distance_km: number; rating: number | null }[];
  };
}) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const create = useTripStore((s) => s.createItineraryItem);
  const fetchItems = useTripStore((s) => s.fetchItineraryItems);
  const [adding, setAdding] = useState<string | null>(null);

  if (p.candidates.length === 0) {
    return (
      <div className={CARD_STYLES}>
        <div className={HEADER_STYLES}>
          <UtensilsCrossed className="h-3 w-3 text-accent" strokeWidth={1.75} /> Dining near {p.anchor.title}
        </div>
        <p className="px-2.5 py-2 font-inter text-[11px] text-muted-foreground">
          No saved dining within {p.radius_km} km. Try adding research to Studio first.
        </p>
      </div>
    );
  }

  async function addToItin(c: { studio_item_id: string; title: string; address: string | null }) {
    if (!activeTrip) return;
    setAdding(c.studio_item_id);
    const item = await create({
      trip_id: activeTrip.id,
      title: c.title,
      category: "dining",
      location_name: c.address,
      date: activeTrip.start_date,
      approval_status: "draft",
    });
    setAdding(null);
    if (item) {
      toast({ title: "Added", description: c.title });
      fetchItems(activeTrip.id);
    }
  }

  return (
    <div className={CARD_STYLES}>
      <div className={HEADER_STYLES}>
        <UtensilsCrossed className="h-3 w-3 text-accent" strokeWidth={1.75} /> Dining near {p.anchor.title} · {p.radius_km} km
      </div>
      <ul className="divide-y divide-border/40">
        {p.candidates.map((c) => (
          <li key={c.studio_item_id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="font-inter text-[11px] font-medium text-foreground truncate">{c.title}</p>
              <p className="font-inter text-[10px] text-muted-foreground truncate">
                {c.distance_km} km{c.rating ? ` · ${c.rating}★` : ""}{c.address ? ` · ${c.address}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!activeTrip || adding === c.studio_item_id}
              onClick={() => addToItin(c)}
              className="h-6 shrink-0 gap-1 rounded-[2px] font-inter text-[10px]"
            >
              {adding === c.studio_item_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
 *  6. summarize_day
 * ============================================================ */
function SummarizeDayCard({ p }: { p: { date: string; narrative: string } }) {
  return (
    <div className={CARD_STYLES}>
      <div className={HEADER_STYLES}>
        <Sun className="h-3 w-3 text-accent" strokeWidth={1.75} /> Day summary · {p.date}
      </div>
      <div className="prose prose-xs max-w-none px-2.5 py-2 font-inter text-[11px] leading-relaxed text-foreground prose-p:my-1.5 prose-strong:text-foreground">
        <Suspense fallback={<span className="text-muted-foreground">…</span>}>
          <ReactMarkdown>{p.narrative}</ReactMarkdown>
        </Suspense>
      </div>
    </div>
  );
}

/* ============================================================
 *  7. suggest_logistics
 * ============================================================ */
function LogisticsCard({
  p,
}: {
  p: {
    gaps: {
      from_date: string;
      to_date: string;
      from_location: string | null;
      to_location: string | null;
      distance_km: number | null;
      options: { mode: string; label: string; rough_duration: string; cost_band: string }[];
    }[];
  };
}) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const create = useTripStore((s) => s.createItineraryItem);
  const fetchItems = useTripStore((s) => s.fetchItineraryItems);
  const [adding, setAdding] = useState<string | null>(null);

  if (p.gaps.length === 0) {
    return (
      <div className={CARD_STYLES}>
        <div className={HEADER_STYLES}>
          <Plane className="h-3 w-3 text-accent" strokeWidth={1.75} /> Logistics
        </div>
        <p className="px-2.5 py-2 font-inter text-[11px] text-muted-foreground">
          No missing transfers detected between location legs.
        </p>
      </div>
    );
  }

  async function addOption(gapIdx: number, opt: { mode: string; label: string }, dateBetween: string) {
    if (!activeTrip) return;
    const key = `${gapIdx}-${opt.label}`;
    setAdding(key);
    const item = await create({
      trip_id: activeTrip.id,
      title: opt.label,
      category: "logistics",
      date: dateBetween,
      approval_status: "draft",
    });
    setAdding(null);
    if (item) {
      toast({ title: "Added to logistics", description: opt.label });
      fetchItems(activeTrip.id);
    }
  }

  return (
    <div className={CARD_STYLES}>
      <div className={HEADER_STYLES}>
        <Plane className="h-3 w-3 text-accent" strokeWidth={1.75} /> {p.gaps.length} transfer gap{p.gaps.length === 1 ? "" : "s"}
      </div>
      <ul className="divide-y divide-border/40">
        {p.gaps.map((g, gi) => (
          <li key={`${g.from_date}-${g.to_date}`} className="px-2.5 py-2 space-y-1.5">
            <p className="font-inter text-[11px] font-medium text-foreground">
              {g.from_location} <ArrowRight className="inline h-3 w-3 text-muted-foreground" /> {g.to_location}
            </p>
            <p className="font-inter text-[10px] text-muted-foreground">
              {g.from_date} → {g.to_date}{g.distance_km ? ` · ${g.distance_km} km` : ""}
            </p>
            <div className="space-y-1">
              {g.options.map((opt) => {
                const key = `${gi}-${opt.label}`;
                return (
                  <div key={key} className="flex items-center justify-between gap-2 rounded-[2px] border border-border/60 px-2 py-1">
                    <div className="min-w-0">
                      <p className="font-inter text-[10px] font-medium text-foreground truncate">{opt.label}</p>
                      <p className="font-inter text-[9px] text-muted-foreground">{opt.rough_duration} · {opt.cost_band}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!activeTrip || adding === key}
                      onClick={() => addOption(gi, opt, g.to_date)}
                      className="h-5 shrink-0 gap-1 rounded-[2px] font-inter text-[9px] px-1.5"
                    >
                      {adding === key ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}