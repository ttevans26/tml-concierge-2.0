import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUri } from "@/lib/authRedirect";
import { ensureDevSession, isDevPreviewHost } from "@/lib/devAutoAuth";
import { toast } from "sonner";

export default function Signup() {
  const { signUp, session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = params.get("redirectTo") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "apple">(null);
  const [autoAuthPending, setAutoAuthPending] = useState<boolean>(
    () => isDevPreviewHost(),
  );

  useEffect(() => {
    if (!isDevPreviewHost()) {
      setAutoAuthPending(false);
      return;
    }
    if (session) {
      setAutoAuthPending(false);
      navigate(redirectTo, { replace: true });
      return;
    }
    let cancelled = false;
    ensureDevSession().then((ok) => {
      if (cancelled) return;
      setAutoAuthPending(false);
      if (ok) navigate(redirectTo, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [session, navigate, redirectTo]);

  if (autoAuthPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="font-inter text-muted-foreground text-sm tracking-wide">Loading…</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      // If email confirmation is enabled, signUp resolves without a session.
      // Detect that and show the "check your inbox" affordance instead of
      // bouncing the user to a protected route they can't reach yet.
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate(redirectTo, { replace: true });
      else toast.success("Check your inbox to confirm your email.");
    }
  };

  const handleGoogle = async () => {
    setOauthLoading("google");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: getAuthRedirectUri(redirectTo),
    });
    if (result.error) {
      setOauthLoading(null);
      toast.error("Google sign-up failed");
      return;
    }
    if (result.redirected) return;
    navigate(redirectTo, { replace: true });
  };

  const handleApple = async () => {
    setOauthLoading("apple");
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: getAuthRedirectUri(redirectTo),
    });
    if (result.error) {
      setOauthLoading(null);
      toast.error("Apple sign-up failed");
      return;
    }
    if (result.redirected) return;
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="font-playfair text-3xl font-bold text-foreground tracking-tight">
            TML Concierge
          </h1>
          <p className="font-inter text-sm text-muted-foreground">
            Create your travel studio account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-thin border-border rounded-[2px] bg-card p-6 space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-thin rounded-[2px] font-inter"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-thin rounded-[2px] font-inter"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
              Confirm Password
            </Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border-thin rounded-[2px] font-inter"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm font-inter text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-[2px] bg-accent text-accent-foreground hover:bg-accent/90 font-inter text-sm tracking-wide"
          >
            {loading ? "Creating account…" : "Create Account"}
          </Button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-border" />
            <span className="mx-3 font-inter text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
            <div className="flex-grow border-t border-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={oauthLoading !== null}
            onClick={handleGoogle}
            className="w-full rounded-[2px] font-inter text-sm border-border hover:bg-secondary"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.11A6.61 6.61 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.95l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={oauthLoading !== null}
            onClick={handleApple}
            className="w-full rounded-[2px] font-inter text-sm border-border hover:bg-secondary"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden fill="currentColor">
              <path d="M16.365 1.43c0 1.14-.46 2.22-1.21 3.01-.81.86-2.13 1.52-3.21 1.44-.13-1.11.42-2.27 1.18-3.05.85-.87 2.29-1.52 3.24-1.4zm3.55 17.34c-.59 1.36-.87 1.97-1.62 3.17-1.05 1.66-2.53 3.73-4.36 3.75-1.63.02-2.05-1.06-4.26-1.05-2.21.01-2.67 1.07-4.3 1.05-1.83-.02-3.23-1.88-4.28-3.55C.21 18.73-.27 13.34 2.05 10.41c1.65-2.08 4.25-3.3 6.7-3.3 2.49 0 4.06 1.36 6.12 1.36 2 0 3.22-1.36 6.1-1.36 2.18 0 4.49 1.19 6.14 3.25-5.4 2.96-4.52 10.69-3.19 8.41z"/>
            </svg>
            {oauthLoading === "apple" ? "Redirecting…" : "Continue with Apple"}
          </Button>

          <p className="text-center text-xs font-inter text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-accent hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>

        <div className="flex justify-center">
          <ConnectionIndicator />
        </div>
      </div>
    </div>
  );
}
