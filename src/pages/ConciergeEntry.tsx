import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTripStore } from "@/stores/useTripStore";

/**
 * Concierge deep-link receiver.
 *
 * Accepts:
 *   /concierge?ask=<text>&trip=<tripId>
 *
 * Behaviour:
 *  - If a trip id is provided (or there's exactly one trip available), we
 *    seed `pendingConciergePrompt` and bounce to the trip workspace —
 *    `ConciergePanel` consumes the prompt on mount and the user lands
 *    inside an answering thread.
 *  - If the user is signed-out, we forward to login with `redirectTo` so
 *    the prompt survives the OAuth round-trip.
 *  - If we can't pick a trip yet, we drop the user on the dashboard with
 *    the prompt waiting in the store.
 */
export default function ConciergeEntry() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, loading } = useAuth();
  const askConcierge = useTripStore((s) => s.askConcierge);
  const trips = useTripStore((s) => s.trips);
  const activeTrip = useTripStore((s) => s.activeTrip);

  useEffect(() => {
    if (loading) return;

    const ask = params.get("ask") || params.get("q") || "";
    const tripParam = params.get("trip");

    // Not signed in → preserve the entire deep link so we resume after auth.
    if (!session) {
      const redirectTo = `/concierge?${params.toString()}`;
      navigate(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { replace: true });
      return;
    }

    if (ask) askConcierge(ask);

    const tripId =
      tripParam ||
      activeTrip?.id ||
      (trips.length === 1 ? trips[0].id : null);

    if (tripId) navigate(`/trip/${tripId}`, { replace: true });
    else navigate("/", { replace: true });
  }, [loading, session, params, askConcierge, navigate, trips, activeTrip]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="font-inter text-sm text-muted-foreground">Opening the Concierge…</p>
    </div>
  );
}