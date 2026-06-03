import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { obs } from "@/lib/observability";

/**
 * Universal OAuth landing page.
 *
 * Handles three return shapes:
 *   1. PKCE / managed flow → `?code=...` (Lovable Cloud broker).
 *   2. Implicit flow → `#access_token=...&refresh_token=...` (legacy / native).
 *   3. Errors → `?error=...&error_description=...`.
 *
 * Once the session is set, we redirect to the path stashed in
 * `?redirectTo=` (or `/` by default). This route is also the target for
 * iOS deep-link returns: `app.lovable.tmlconcierge://auth/callback#…`.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const redirectTo = params.get("redirectTo") || "/";

        // Error case first — surface a useful message instead of a hang.
        const err = params.get("error_description") || params.get("error");
        if (err) {
          obs.captureMessage("oauth_callback_error", "warning", { err });
          setStatus("error");
          setMessage(decodeURIComponent(err));
          return;
        }

        // PKCE / code-exchange flow.
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) navigate(redirectTo, { replace: true });
          return;
        }

        // Implicit-flow fragment (native OAuth returns commonly use this).
        if (window.location.hash.includes("access_token")) {
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;
            if (!cancelled) navigate(redirectTo, { replace: true });
            return;
          }
        }

        // Nothing to do — session may already be live from another tab.
        const { data } = await supabase.auth.getSession();
        if (!cancelled) navigate(data.session ? redirectTo : "/login", { replace: true });
      } catch (e) {
        obs.captureException(e, { where: "AuthCallback" });
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "Sign-in failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="font-playfair text-2xl text-foreground">
          {status === "working" ? "Just a moment" : "Sign-in interrupted"}
        </h1>
        <p className="font-inter text-sm text-muted-foreground">{message}</p>
        {status === "error" && (
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="font-inter text-xs uppercase tracking-widest text-accent hover:underline underline-offset-4"
          >
            Back to sign-in
          </button>
        )}
      </div>
    </div>
  );
}