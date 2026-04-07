import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripStore } from "@/stores/useTripStore";
import StudioSidebar from "@/components/workspace/StudioSidebar";
import MatrixGrid from "@/components/workspace/MatrixGrid";
import BudgetSidebar from "@/components/workspace/BudgetSidebar";

export default function TripWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trips, activeTrip, loading, fetchTrips, fetchItineraryItems, setActiveTrip } =
    useTripStore();

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
        <div>
          <h1 className="font-playfair text-base font-semibold text-foreground leading-tight">
            {activeTrip.name}
          </h1>
          {activeTrip.destination && (
            <p className="font-inter text-[11px] text-muted-foreground">
              {activeTrip.destination}
            </p>
          )}
        </div>
      </header>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Ideas Vault 20% */}
        <div className="hidden w-[20%] shrink-0 lg:block">
          <StudioSidebar />
        </div>

        {/* Center — Matrix Grid 60% */}
        <div className="flex-1 lg:w-[60%]">
          <MatrixGrid />
        </div>

        {/* Right — Budget Sidebar 20% */}
        <div className="hidden w-[20%] shrink-0 lg:block">
          <BudgetSidebar />
        </div>
      </div>
    </div>
  );
}
