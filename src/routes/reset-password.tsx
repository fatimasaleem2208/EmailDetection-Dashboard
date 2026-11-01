import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scorePassword } from "@/lib/scan-schemas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — PhishGuard AI" },
      {
        name: "description",
        content: "Choose a new password for your PhishGuard AI phishing detection account.",
      },
      { property: "og:title", content: "Set a new password — PhishGuard AI" },
      {
        property: "og:description",
        content: "Complete your PhishGuard AI password reset securely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const STRENGTH_COLOR = ["bg-critical", "bg-warning", "bg-caution", "bg-safe", "bg-safe"];

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  useEffect(() => {
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session) || isRecovery);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Both passwords must match.");
      return;
    }
    if (strength.score < 2) {
      toast.error("Choose a stronger password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="glass-panel animate-rise rounded-2xl p-7">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready
              ? "Choose a strong password you don't use anywhere else."
              : "Open this page from the reset link in your email to continue."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  minLength={8}
                  required
                  disabled={!ready}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors",
                          i < strength.score ? STRENGTH_COLOR[strength.score] : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{strength.label}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  minLength={8}
                  required
                  disabled={!ready}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
