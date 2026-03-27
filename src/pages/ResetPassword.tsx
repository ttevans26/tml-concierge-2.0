import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConnectionIndicator from "@/components/ConnectionIndicator";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setValid(true);
    }
  }, []);

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
    const { error } = await updatePassword(password);
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
        <div className="text-center space-y-1">
          <h1 className="font-playfair text-3xl font-bold text-foreground tracking-tight">
            Set New Password
          </h1>
          <p className="font-inter text-sm text-muted-foreground">
            Choose a strong new password
          </p>
        </div>

        <div className="border-thin border-border rounded-[2px] bg-card p-6 space-y-5">
          {!valid ? (
            <p className="font-inter text-sm text-muted-foreground text-center">
              Invalid or expired recovery link. Please request a new one.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="font-inter text-xs uppercase tracking-widest text-muted-foreground">
                  New Password
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
                {loading ? "Updating…" : "Update Password"}
              </Button>
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
