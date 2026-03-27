import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConnectionIndicator from "@/components/ConnectionIndicator";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="font-playfair text-3xl font-bold text-foreground tracking-tight">
            Reset Password
          </h1>
          <p className="font-inter text-sm text-muted-foreground">
            We'll send you a recovery link
          </p>
        </div>

        <div className="border-thin border-border rounded-[2px] bg-card p-6 space-y-5">
          {sent ? (
            <div className="text-center space-y-3">
              <p className="font-inter text-sm text-foreground">
                Check your inbox for a password reset link.
              </p>
              <Link to="/login" className="font-inter text-xs text-accent hover:underline underline-offset-4">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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

              {error && (
                <p className="text-sm font-inter text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-[2px] bg-accent text-accent-foreground hover:bg-accent/90 font-inter text-sm tracking-wide"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>

              <p className="text-center text-xs font-inter text-muted-foreground">
                <Link to="/login" className="text-accent hover:underline underline-offset-4">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>

        <div className="flex justify-center">
          <ConnectionIndicator />
        </div>
      </div>
    </div>
  );
}
