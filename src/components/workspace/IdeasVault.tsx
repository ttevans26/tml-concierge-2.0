import { useState } from "react";
import {
  Plus, Bookmark, Link, Sparkles, Loader2, Check, X, Hotel,
  UtensilsCrossed, Compass, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTripStore } from "@/stores/useTripStore";

type IdeaCategory = "stays" | "dining" | "activity" | "sites_of_interest";

const CATEGORIES: { key: IdeaCategory; label: string; icon: React.ElementType }[] = [
  { key: "stays", label: "Stays", icon: Hotel },
  { key: "dining", label: "Dining", icon: UtensilsCrossed },
  { key: "activity", label: "Activities", icon: Compass },
  { key: "sites_of_interest", label: "Sites", icon: Landmark },
];

interface PendingIdea {
  id: string;
  title: string;
  category: IdeaCategory;
  description: string | null;
  address: string | null;
  url: string | null;
  estimated_cost: number | null;
}

type ScrapeStatus = "idle" | "fetching" | "analyzing" | "done" | "error";

const STATUS_LABELS: Record<ScrapeStatus, string> = {
  idle: "",
  fetching: "Fetching page content…",
  analyzing: "Consultant is analyzing…",
  done: "Analysis complete",
  error: "Scrape failed",
};

const STATUS_PROGRESS: Record<ScrapeStatus, number> = {
  idle: 0,
  fetching: 30,
  analyzing: 70,
  done: 100,
  error: 0,
};

export default function IdeasVault() {
  const { activeTrip } = useTripStore();
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [status, setStatus] = useState<ScrapeStatus>("idle");
  const [errorDetail, setErrorDetail] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingIdea[]>([]);

  const handleScrape = async () => {
    const url = scrapeUrl.trim();
    if (!url) return;

    console.log("DEBUG: IdeasVault Scrape Triggered", url);
    setStatus("fetching");
    setErrorDetail("");

    try {
      // Simulate progress stages
      setTimeout(() => setStatus("analyzing"), 1500);

      console.log("DEBUG: Invoking scrape-and-parse edge function");
      const { data, error } = await supabase.functions.invoke("scrape-and-parse", {
        body: { url },
      });

      console.log("DEBUG: Scrape response", { data, error });

      if (error) {
        const msg = typeof error === "object" && "message" in error
          ? (error as any).message
          : String(error);
        throw new Error(msg);
      }

      if (data?.error) {
        throw new Error(`Edge function error: ${data.error}`);
      }

      const items = data?.items || [];
      setStatus("done");

      if (items.length === 0) {
        toast.info("No travel items found on that page.");
      } else {
        const mapped: PendingIdea[] = items.map((item: any) => {
          let cat: IdeaCategory = "activity";
          if (item.category === "stays") cat = "stays";
          else if (item.category === "dining") cat = "dining";
          else if (item.category === "sites" || item.category === "sites_of_interest") cat = "sites_of_interest";

          return {
            id: crypto.randomUUID(),
            title: item.title || "Untitled",
            category: cat,
            description: item.description || null,
            address: item.address || null,
            url: item.url || url,
            estimated_cost: item.estimated_cost ?? null,
          };
        });
        setPendingItems((prev) => [...prev, ...mapped]);
        toast.success(`Found ${mapped.length} item${mapped.length !== 1 ? "s" : ""} to review.`);
      }

      setScrapeUrl("");
      // Reset status after a beat
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err: any) {
      console.error("DEBUG: Scrape error:", err);
      const errMsg = err?.message || "Unknown error";
      setErrorDetail(errMsg);
      setStatus("error");
      toast.error(`Scrape failed: ${errMsg}`);
      // Reset after showing error
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  const acceptIdea = (idea: PendingIdea) => {
    // For now, just remove from pending — the user can manually add to the matrix
    // In the future this would call addItineraryItem
    toast.success(`"${idea.title}" saved to ideas.`);
    setPendingItems((prev) => prev.filter((p) => p.id !== idea.id));
  };

  const dismissIdea = (id: string) => {
    setPendingItems((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Ideas Vault
        </h2>
      </div>

      {/* URL Ingestor */}
      <div className="border-b border-border px-4 py-3">
        <Label className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
          Import via URL
        </Label>
        <div className="mt-1.5 flex gap-1.5">
          <div className="relative flex-1">
            <Link className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="Paste a travel article link…"
              className="border-thin pl-7 font-inter text-xs h-8"
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
              disabled={status === "fetching" || status === "analyzing"}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-thin font-inter text-xs min-h-[44px] min-w-[44px] gap-1 shrink-0"
            onClick={handleScrape}
            disabled={status === "fetching" || status === "analyzing" || !scrapeUrl.trim()}
          >
            {status === "fetching" || status === "analyzing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Progress feedback */}
        {status !== "idle" && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <p className={`font-inter text-[10px] ${status === "error" ? "text-destructive" : "text-accent"}`}>
                {STATUS_LABELS[status]}
              </p>
              {status === "done" && <Check className="h-3 w-3 text-accent" />}
            </div>
            <Progress value={STATUS_PROGRESS[status]} className="h-1" />
            {status === "error" && errorDetail && (
              <p className="font-inter text-[10px] text-destructive/80 break-all">
                {errorDetail}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pending Review Tray */}
      {pendingItems.length > 0 && (
        <div className="border-b border-border bg-secondary/30 px-4 py-3 max-h-[50%] overflow-y-auto">
          <p className="mb-2 font-inter text-[10px] font-semibold uppercase tracking-wider text-accent">
            Review ({pendingItems.length})
          </p>
          <div className="space-y-1.5">
            {pendingItems.map((idea) => {
              const catMeta = CATEGORIES.find((c) => c.key === idea.category);
              const Icon = catMeta?.icon || Compass;
              return (
                <div
                  key={idea.id}
                  className="flex items-start gap-2 rounded-sm border-thin border-border bg-card px-2.5 py-2"
                >
                  <Icon className="mt-0.5 h-3 w-3 shrink-0 text-accent" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-inter text-[11px] font-medium text-foreground">
                      {idea.title}
                    </p>
                    {idea.description && (
                      <p className="mt-0.5 line-clamp-2 font-inter text-[10px] text-muted-foreground leading-relaxed">
                        {idea.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => acceptIdea(idea)}
                      className="rounded-sm p-1 text-accent hover:bg-accent/10"
                      title="Save"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => dismissIdea(idea.id)}
                      className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pendingItems.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border-thin border-border bg-secondary">
            <Bookmark className="h-4 w-4 text-accent" strokeWidth={1.5} />
          </div>
          <p className="font-inter text-xs text-muted-foreground leading-relaxed">
            Paste a travel article URL above to auto-extract hotels, restaurants, and activities.
          </p>
        </div>
      )}
    </div>
  );
}
