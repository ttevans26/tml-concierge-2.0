import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GmailStatus =
  | { state: "loading" }
  | { state: "connected" }
  | { state: "disconnected"; reason?: string };

/**
 * Pings the smart-pull-gmail edge function in `status` mode to determine if
 * the workspace Gmail connector is currently usable. Cached per session.
 */
export function useGmailConnectionStatus(enabled = true): GmailStatus {
  const [status, setStatus] = useState<GmailStatus>({ state: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("smart-pull-gmail", {
          body: { mode: "status" },
        });
        if (cancelled) return;
        if (error) {
          setStatus({ state: "disconnected", reason: error.message });
          return;
        }
        if (data?.connected) setStatus({ state: "connected" });
        else setStatus({ state: "disconnected", reason: data?.reason });
      } catch (e) {
        if (!cancelled) {
          setStatus({
            state: "disconnected",
            reason: e instanceof Error ? e.message : "Unknown",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return status;
}