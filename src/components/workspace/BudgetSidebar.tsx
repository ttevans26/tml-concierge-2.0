import { Wallet, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTripStore, selectTotalReservedCost, selectRemainingBudget } from "@/stores/useTripStore";

export default function BudgetSidebar() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const totalSpent = useTripStore(selectTotalReservedCost);
  const remaining = useTripStore(selectRemainingBudget);

  const budget = activeTrip?.total_trip_budget ? Number(activeTrip.total_trip_budget) : 0;
  const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Budget Reserve
        </h2>
      </div>

      {/* Remaining budget hero */}
      <div className="border-b border-border bg-secondary/20 px-4 py-5 text-center">
        <p className="font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
          Remaining Budget
        </p>
        <p className="mt-1 font-playfair text-2xl font-bold text-accent">
          {budget > 0 ? `$${remaining.toLocaleString()}` : "—"}
        </p>
      </div>

      {/* Budget bar */}
      <div className="space-y-6 px-4 py-6">
        {/* Total budget */}
        <div className="space-y-1">
          <p className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
            Total Budget
          </p>
          <p className="font-playfair text-xl font-semibold text-foreground">
            {budget > 0 ? `$${budget.toLocaleString()}` : "Not set"}
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-inter text-[11px] text-muted-foreground">Reserved</span>
            <span className="font-inter text-xs font-medium text-foreground">
              ${totalSpent.toLocaleString()}
            </span>
          </div>
          <Progress value={pct} className="h-2 bg-secondary" />
          <div className="flex items-center justify-between">
            <span className="font-inter text-[11px] text-muted-foreground">Remaining</span>
            <span className="font-inter text-xs font-medium text-accent">
              ${remaining.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <span className="font-inter text-xs text-muted-foreground">
              {itineraryItems.length} item{itineraryItems.length !== 1 ? "s" : ""} planned
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <span className="font-inter text-xs text-muted-foreground">
              {Math.round(pct)}% allocated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
