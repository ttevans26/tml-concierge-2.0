/**
 * Zustand `persist` storage adapter that uses Capacitor Preferences on
 * native (durable across app restarts, survives offline) and falls back to
 * window.localStorage in the browser/preview.
 */
import type { StateStorage } from "zustand/middleware";
import { Capacitor } from "@capacitor/core";

const useNative = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

let _prefs: typeof import("@capacitor/preferences").Preferences | null = null;
async function prefs() {
  if (_prefs) return _prefs;
  const mod = await import("@capacitor/preferences");
  _prefs = mod.Preferences;
  return _prefs;
}

export const nativeStorage: StateStorage = {
  getItem: async (name) => {
    if (useNative) {
      try {
        const p = await prefs();
        const { value } = await p.get({ key: name });
        return value ?? null;
      } catch (e) {
        console.warn("[persist] native get failed, falling back to localStorage", e);
      }
    }
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    if (useNative) {
      try {
        const p = await prefs();
        await p.set({ key: name, value });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* quota / private mode — ignore */
    }
  },
  removeItem: async (name) => {
    if (useNative) {
      try {
        const p = await prefs();
        await p.remove({ key: name });
        return;
      } catch {
        /* ignore */
      }
    }
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};