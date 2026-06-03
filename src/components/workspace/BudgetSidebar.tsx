import { Wallet, TrendingUp, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTripStore, selectTotalReservedCost, selectRemainingBudget } from "@/stores/useTripStore";
import { useMemo } from "react";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD"] as const;

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
};

export default function BudgetSidebar({
  onCollapse,
  embedded = false,
}: { onCollapse?: () => void; embedded?: boolean } = {}) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const totalSpent = useTripStore(selectTotalReservedCost);
  const remaining = useTripStore(selectRemainingBudget);
  const updateTrip = useTripStore((s) => s.updateTrip);

  // Trip's storage currency (where cost values live) is implicitly USD.
  // display_currency lets the user reframe the same numbers using fx_rates.
  const displayCurrency = (activeTrip?.display_currency || "USD") as string;
  const fxRates = (activeTrip?.fx_rates as Record<string, number> | null) || null;
  const rate = useMemo(() => {
    if (displayCurrency === "USD") return 1;
    const r = fxRates?.[displayCurrency];
    return typeof r === "number" && r > 0 ? r : 1;
  }, [displayCurrency, fxRates]);

  const symbol = SYMBOLS[displayCurrency] ?? "";
  const fmt = (n: number) =>
    `${symbol}${(n * rate).toLocaleString(undefined, {
      maximumFractionDigits: displayCurrency === "JPY" ? 0 : 0,
    })}`;

  const budget = activeTrip?.total_trip_budget ? Number(activeTrip.total_trip_budget) : 0;
  const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const fxMissing = displayCurrency !== "USD" && !fxRates?.[displayCurrency];

  const handleCurrencyChange = (next: string) => {
    if (!activeTrip) return;
    void updateTrip(activeTrip.id, { display_currency: next });
  };

  return (
    <div
      className={`flex h-full w-full min-w-0 flex-col bg-card overflow-hidden ${
        embedded ? "" : "border-l border-border"
      }`}
    >
      {/* Header */}
      {!embedded && (
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
        <h2 className="truncate font-playfair text-sm font-semibold text-foreground">
          Budget Reserve
        </h2>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={onCollapse}
            title="Collapse"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      )}

      {/* Remaining budget hero */}
      <div className="border-b border-border bg-secondary/20 px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <p className="font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
            Remaining Budget
          </p>
          {activeTrip && (
            <Select value={displayCurrency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="h-5 w-[64px] rounded-[2px] border-none bg-transparent px-1 py-0 font-inter text-[10px] uppercase tracking-wider text-accent hover:bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="font-inter text-[11px]">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="mt-1 font-playfair text-2xl font-bold text-accent">
          {budget > 0 ? fmt(remaining) : "—"}
        </p>
        {fxMissing && (
          <p className="mt-1 font-inter text-[9px] uppercase tracking-wider text-destructive">
            FX rate unavailable — showing USD values
          </p>
        )}
      </div>

      {/* Budget bar */}
      <div className="space-y-6 px-4 py-6">
        {/* Total budget */}
        <div className="space-y-1">
          <p className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
            Total Budget
          </p>
          <p className="font-playfair text-xl font-semibold text-foreground">
            {budget > 0 ? fmt(budget) : "Not set"}
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-inter text-[11px] text-muted-foreground">Reserved</span>
            <span className="font-inter text-xs font-medium text-foreground">
              {fmt(totalSpent)}
            </span>
          </div>
          <Progress value={pct} className="h-2 bg-secondary" />
          <div className="flex items-center justify-between">
            <span className="font-inter text-[11px] text-muted-foreground">Remaining</span>
            <span className="font-inter text-xs font-medium text-accent">
              {fmt(remaining)}
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
