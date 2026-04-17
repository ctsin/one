import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setAuth, type AuthUser } from "@/lib/auth";

interface SignInProps {
  onSuccess: () => void;
}

export function SignIn({ onSuccess }: SignInProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as {
        token: string;
        user: AuthUser;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      setAuth(data.token, data.user);
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            One
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your phone number to continue
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            autoFocus
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !phone.trim()}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
