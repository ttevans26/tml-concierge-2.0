import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { parseDeepLink } from "@/lib/deepLinks";
import { isNative } from "@/lib/native";
import { obs } from "@/lib/observability";

/**
 * Mounts a single deep-link listener that bridges native `appUrlOpen`
 * events into React Router. Safe to mount once at the top of the router
 * tree — it no-ops on web (where the browser's address bar already drives
 * the router).
 *
 * Also listens for a custom `app:deeplink` window event so other code
 * (e.g. push-notification handlers) can request a programmatic navigation
 * without needing a router ref.
 */
export function useDeepLinks(): void {
  const navigate = useNavigate();

  useEffect(() => {
    let removeNative: (() => void) | null = null;

    const handle = (rawUrl: string, source: "native" | "event") => {
      const parsed = parseDeepLink(rawUrl);
      if (!parsed) {
        if (import.meta.env.DEV) console.warn("[deeplink] unrecognised", rawUrl);
        return;
      }
      obs.breadcrumb("deeplink", parsed.intent, { source, to: parsed.to });
      navigate(parsed.to, { replace: false });
    };

    // 1. Native (Capacitor App plugin) — only registers on iOS/Android.
    if (isNative()) {
      (async () => {
        try {
          const { App } = await import("@capacitor/app");
          const sub = await App.addListener("appUrlOpen", ({ url }) => {
            handle(url, "native");
          });
          removeNative = () => sub.remove();

          // Cold-start case: the OS launched the app via deep link; flush
          // the initial URL once the router is mounted.
          const launch = await App.getLaunchUrl();
          if (launch?.url) handle(launch.url, "native");
        } catch (e) {
          console.warn("[deeplink] native listener unavailable", e);
        }
      })();
    }

    // 2. In-process custom event — lets push handlers / share intents
    //    request navigation without importing the router.
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") handle(detail, "event");
    };
    window.addEventListener("app:deeplink", onCustom);

    return () => {
      removeNative?.();
      window.removeEventListener("app:deeplink", onCustom);
    };
  }, [navigate]);
}