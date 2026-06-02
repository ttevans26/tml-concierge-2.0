import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/native";

// Fire-and-forget native init — no-ops on web.
initNative(() => {
  // On resume, refresh active trip data in background.
  import("./stores/useTripStore").then(({ useTripStore }) => {
    const s = useTripStore.getState();
    if (s.activeTrip?.id) {
      s.fetchItineraryItems(s.activeTrip.id);
      s.fetchFlights(s.activeTrip.id);
    }
    s.fetchTrips();
  });
});

createRoot(document.getElementById("root")!).render(<App />);
