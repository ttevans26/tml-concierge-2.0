import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "checking" | "connected" | "error";

export default function ConnectionIndicator() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Lightweight health check — reads the auth session endpoint
        const { error } = await supabase.auth.getSession();
        if (!cancelled) setStatus(error ? "error" : "connected");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const color =
    status === "connected"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-destructive"
        : "bg-muted-foreground animate-pulse";

  const label =
    status === "connected"
      ? "Backend connected"
      : status === "error"
        ? "Connection error"
        : "Checking…";

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-inter text-muted-foreground select-none">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
