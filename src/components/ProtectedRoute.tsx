import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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
