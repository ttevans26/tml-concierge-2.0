import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConnectionIndicator from "@/components/ConnectionIndicator";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
