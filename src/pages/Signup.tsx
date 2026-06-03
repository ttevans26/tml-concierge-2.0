import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

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
      // Zero-verification: immediate session — redirect to dashboard
      navigate("/");
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setOauthLoading(false);
      toast.error("Google sign-up failed");
      return;
    }
    if (result.redirected) return;
    navigate("/");
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
            disabled={oauthLoading}
            onClick={handleGoogle}
            className="w-full rounded-[2px] font-inter text-sm border-border hover:bg-secondary"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.11A6.61 6.61 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.95l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            {oauthLoading ? "Redirecting…" : "Continue with Google"}
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
