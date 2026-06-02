/**
 * Capacitor native helpers. All functions are safe to call on web —
 * they no-op when not running inside the iOS shell.
 */
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const isIOS = (): boolean => {
  try {
    return Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
};

/** Initialize native plugins (status bar style, splash hide, app resume hook). */
export async function initNative(onResume?: () => void) {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light }); // dark text on cream
    await StatusBar.setBackgroundColor({ color: "#FDFCF8" }).catch(() => {});
  } catch (e) {
    console.warn("[native] status bar init failed", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {}

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && onResume) onResume();
    });
  } catch {}
}

/** Hook reporting `true` when the browser/device is offline. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    let cleanup = () => {};

    if (isNative()) {
      let removeFn: (() => void) | null = null;
      (async () => {
        try {
          const { Network } = await import("@capacitor/network");
          const status = await Network.getStatus();
          setOnline(status.connected);
          const handle = await Network.addListener("networkStatusChange", (s) => {
            setOnline(s.connected);
          });
          removeFn = () => handle.remove();
        } catch (e) {
          console.warn("[native] Network plugin unavailable", e);
        }
      })();
      cleanup = () => removeFn?.();
    } else {
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      cleanup = () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }

    return cleanup;
  }, []);

  return online;
}

/**
 * Open a location in the native Maps app on iOS, Google Maps on web/Android.
 */
export function openInMaps(opts: {
  google_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  query?: string | null;
}) {
  const { google_place_id, lat, lng, query } = opts;

  let url: string;
  if (isIOS()) {
    if (lat != null && lng != null) {
      url = `maps://?q=${encodeURIComponent(query || "")}&ll=${lat},${lng}`;
    } else if (query) {
      url = `maps://?q=${encodeURIComponent(query)}`;
    } else {
      return;
    }
  } else if (google_place_id) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query || "",
    )}&query_place_id=${google_place_id}`;
  } else if (lat != null && lng != null) {
    url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  } else if (query) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  } else {
    return;
  }

  window.open(url, "_blank");
}