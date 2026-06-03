import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
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
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-playfair text-3xl font-bold text-foreground tracking-tight">
            TML Concierge
          </h1>
          <p className="font-inter text-sm text-muted-foreground">
            Sign in to your travel studio
          </p>
        </div>

        {/* Card */}
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

          {error && (
            <p className="text-sm font-inter text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-[2px] bg-accent text-accent-foreground hover:bg-accent/90 font-inter text-sm tracking-wide"
          >
            {loading ? "Signing in…" : "Sign In"}
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

          <div className="flex items-center justify-between text-xs font-inter">
            <Link to="/signup" className="text-accent hover:underline underline-offset-4">
              Create account
            </Link>
            <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
        </form>

        {/* Connection indicator */}
        <div className="flex justify-center">
          <ConnectionIndicator />
        </div>
      </div>
    </div>
  );
}
