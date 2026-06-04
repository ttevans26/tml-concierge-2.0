import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ensureDevSession, isDevPreviewHost } from "@/lib/devAutoAuth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  // In Lovable preview / localhost we skip the login screen entirely by
  // auto-signing into a shared dev account. The flag stays true while
  // the sign-in is in flight so we render the loading state instead of
  // bouncing through /login.
  const [autoAuthPending, setAutoAuthPending] = useState<boolean>(
    () => isDevPreviewHost(),
  );

  useEffect(() => {
    if (loading) return;
    if (session) {
      setAutoAuthPending(false);
      return;
    }
    if (!isDevPreviewHost()) {
      setAutoAuthPending(false);
      return;
    }
    let cancelled = false;
    ensureDevSession().finally(() => {
      if (!cancelled) setAutoAuthPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, session]);

  if (loading || autoAuthPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="font-inter text-muted-foreground text-sm tracking-wide">Loading…</p>
      </div>
    );
  }

  if (!session) {
    // Preserve the deep-link target so the user resumes where they intended
    // after sign-in (Login/Signup honour ?redirectTo=).
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    const search =
      redirectTo && redirectTo !== "/"
        ? `?redirectTo=${encodeURIComponent(redirectTo)}`
        : "";
    return <Navigate to={`/login${search}`} replace />;
  }

  return <>{children}</>;
}
