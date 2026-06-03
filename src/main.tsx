import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/native";
import "./i18n";
import { initWebVitals, registerAnalytics, registerErrorReporter, obs } from "./lib/observability";

// Observability bootstrap — no-op until DSN/keys are set in env.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

if (SENTRY_DSN) {
  import("./lib/observability/sentry")
    .then(({ createSentryReporter }) => createSentryReporter(SENTRY_DSN))
    .then(registerErrorReporter)
    .catch((e) => console.warn("[obs] sentry init failed", e));
}
if (POSTHOG_KEY) {
  import("./lib/observability/posthog")
    .then(({ createPostHogAnalytics }) => createPostHogAnalytics(POSTHOG_KEY, POSTHOG_HOST))
    .then(registerAnalytics)
    .catch((e) => console.warn("[obs] posthog init failed", e));
}
void initWebVitals();

window.addEventListener("error", (e) => obs.captureException(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => obs.captureException(e.reason));

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
