import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, ChevronLeft, Wallet, Sparkles, MapPin, ListChecks, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripStore } from "@/stores/useTripStore";
import StudioSidebar from "@/components/workspace/StudioSidebar";
import MatrixGrid from "@/components/workspace/MatrixGrid";
import BudgetSidebar from "@/components/workspace/BudgetSidebar";
import ConciergePanel from "@/components/workspace/ConciergePanel";
import ProximityMap from "@/components/workspace/ProximityMap";
import TripHealthBar from "@/components/workspace/TripHealthBar";
import TripSwitcher from "@/components/workspace/TripSwitcher";
import PackingList from "@/components/workspace/PackingList";
import TripDocuments from "@/components/workspace/TripDocuments";
import EditTripDialog from "@/components/workspace/EditTripDialog";
import { cn } from "@/lib/utils";

export default function TripWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trips, activeTrip, loading, fetchTrips, fetchItineraryItems, setActiveTrip } =
    useTripStore();

  const [studioOpen, setStudioOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("tml-studio-open") !== "false";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("tml-studio-open", String(studioOpen));
    } catch {
      /* ignore */
    }
  }, [studioOpen]);

  const [budgetOpen, setBudgetOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("tml-budget-open") !== "false";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("tml-budget-open", String(budgetOpen));
    } catch {
      /* ignore */
    }
  }, [budgetOpen]);

  const [rightTab, setRightTab] =
    useState<"budget" | "concierge" | "map" | "packing" | "documents">("budget");
  const [editTripOpen, setEditTripOpen] = useState(false);
  const askConcierge = useTripStore((s) => s.askConcierge);

  const handleAskConcierge = (prompt: string) => {
    setBudgetOpen(true);
    setRightTab("concierge");
    askConcierge(prompt);
  };

  /* Hydrate trip + itinerary */
  useEffect(() => {
    if (trips.length === 0) fetchTrips();
  }, [trips.length, fetchTrips]);

  useEffect(() => {
    if (!id) return;
    const found = trips.find((t) => t.id === id) ?? null;
    setActiveTrip(found);
    if (found) fetchItineraryItems(id);
  }, [id, trips, setActiveTrip, fetchItineraryItems]);

  /* Cleanup on unmount */
  useEffect(() => () => setActiveTrip(null), [setActiveTrip]);

  if (loading && !activeTrip) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Skeleton className="h-8 w-48 rounded-sm" />
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="font-inter text-sm text-muted-foreground">Trip not found.</p>
        <Button variant="ghost" className="mt-4 font-inter text-sm" onClick={() => navigate("/")}>
          ← Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <TripSwitcher />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setEditTripOpen(true)}
          title="Edit trip dates & segments"
          aria-label="Edit trip"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </header>

      <EditTripDialog open={editTripOpen} onOpenChange={setEditTripOpen} />

      {/* Trip Health Bar */}
      <TripHealthBar onAskConcierge={handleAskConcierge} />

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Studio Folders (collapsible) */}
        {studioOpen ? (
          <div className="hidden w-[20%] min-w-[220px] shrink-0 lg:block">
            <StudioSidebar onCollapse={() => setStudioOpen(false)} />
          </div>
        ) : (
          <div className="hidden w-10 shrink-0 border-r border-border bg-card lg:flex flex-col items-center py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setStudioOpen(true)}
              title="Expand Studio Folders"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="mt-3 font-inter text-[10px] uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
              Studio
            </span>
          </div>
        )}

        {/* Center — Matrix Grid */}
        <div className="flex-1 min-w-0">
          <MatrixGrid />
        </div>

        {/* Right — Budget Sidebar 20% */}
        {budgetOpen ? (
          <div className="hidden w-[22%] min-w-[260px] shrink-0 lg:flex flex-col border-l border-border bg-card">
            {/* Tabs */}
            <div className="flex shrink-0 border-b border-border">
              {([
                { id: "budget", label: "Budget", Icon: Wallet },
                { id: "concierge", label: "Concierge", Icon: Sparkles },
                { id: "map", label: "Map", Icon: MapPin },
                { id: "packing", label: "Pack", Icon: ListChecks },
                { id: "documents", label: "Docs", Icon: FileText },
              ] as const).map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => setRightTab(id)}
                  className={cn(
                    "flex-1 min-h-[44px] rounded-none px-1 font-inter text-[11px] uppercase tracking-wider gap-1.5",
                    rightTab === id
                      ? "border-b-2 border-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setBudgetOpen(false)}
                title="Collapse panel"
                className="min-h-[44px] w-8 shrink-0 rounded-none text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {rightTab === "budget" && (
                <BudgetSidebar embedded onCollapse={() => setBudgetOpen(false)} />
              )}
              {rightTab === "concierge" && <ConciergePanel />}
              {rightTab === "map" && <ProximityMap />}
              {rightTab === "packing" && <PackingList />}
              {rightTab === "documents" && <TripDocuments />}
            </div>
          </div>
        ) : (
          <div className="hidden w-10 shrink-0 border-l border-border bg-card lg:flex flex-col items-center py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setBudgetOpen(true)}
              title="Expand Budget Reserve"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="mt-3 font-inter text-[10px] uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
              Budget · Concierge · Pack · Docs
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
