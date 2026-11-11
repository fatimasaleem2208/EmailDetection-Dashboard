import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scorePassword } from "@/lib/scan-schemas";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "register", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — EmailDetection Threat Console" },
      {
        name: "description",
        content:
          "Access your EmailDetection console to scan suspicious emails, inspect URLs and review phishing detection history.",
      },
      { property: "og:title", content: "Sign in — EmailDetection" },
      {
        property: "og:description",
        content: "Secure access to the EmailDetection phishing detection console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "register" | "forgot";
type OtpFlow = "signup" | "google";
const GOOGLE_OTP_PENDING = "emaildetection-google-otp-pending";

const STRENGTH_COLOR = ["bg-critical", "bg-warning", "bg-caution", "bg-safe", "bg-safe"];

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);
  const [otpFlow, setOtpFlow] = useState<OtpFlow | null>(null);
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  const strength = useMemo(() => scorePassword(password), [password]);
  const destination = useMemo(() => {
    const value = search.redirect;
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
    return value;
  }, [search.redirect]);

  useEffect(() => {
    if (search.mode) {
      setMode(search.mode);
    }
  }, [search.mode]);

  useEffect(() => {
    let alive = true;
    const processSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive || !data.session) return;
      if (sessionStorage.getItem(GOOGLE_OTP_PENDING) === "1") {
        // The OAuth callback has completed. Require a separate mailbox code before entering.
        const googleEmail = data.session.user.email;
        if (!googleEmail) {
          await supabase.auth.signOut();
          sessionStorage.removeItem(GOOGLE_OTP_PENDING);
          toast.error("Your Google account did not provide an email address.");
          return;
        }
        sessionStorage.removeItem(GOOGLE_OTP_PENDING);
        await supabase.auth.signOut();
        setOtpEmail(googleEmail);
        setOtpFlow("google");
        const { error } = await supabase.auth.signInWithOtp({
          email: googleEmail,
          options: { shouldCreateUser: false },
        });
        if (error) toast.error(error.message);
        else toast.success(`Verification code sent to ${googleEmail}`);
        return;
      }
      if (!otpFlow) navigate({ to: destination, replace: true });
    };
    void processSession();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        if (sessionStorage.getItem(GOOGLE_OTP_PENDING) !== "1" && !otpFlow) {
          navigate({ to: destination, replace: true });
        }
      }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [destination, navigate, otpFlow]);

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otpFlow || otp.length !== 6) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otp.trim(),
        type: otpFlow === "signup" ? "signup" : "email",
      });
      if (error) throw error;
      if (!data.session) throw new Error("Verification succeeded but no session was returned.");
      setOtpFlow(null);
      setOtp("");
      toast.success("Email verified successfully.");
      navigate({ to: destination, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid verification code.");
    } finally { setLoading(false); }
  };

  const resendCode = async () => {
    if (!otpFlow) return;
    setLoading(true);
    try {
      const { error } = otpFlow === "signup"
        ? await supabase.auth.resend({ type: "signup", email: otpEmail })
        : await supabase.auth.signInWithOtp({ email: otpEmail, options: { shouldCreateUser: false } });
      if (error) throw error;
      toast.success("A fresh verification code has been sent.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not resend the code."); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        let { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back — console unlocked.");
        navigate({ to: destination, replace: true });
      } else if (mode === "register") {
        if (strength.score < 2) {
          toast.error("Choose a stronger password before creating your account.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        // The Supabase "Confirm email" option MUST be enabled in the dashboard.
        if (data.session) {
          await supabase.auth.signOut();
          throw new Error("Enable Confirm email in Supabase Auth settings to require OTP registration.");
        }
        setOtpEmail(email.trim());
        setOtp("");
        setOtpFlow("signup");
        toast.success("Enter the 6-digit code sent to your email.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
        toast.success("If that address exists, a reset link is on its way.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      sessionStorage.setItem(GOOGLE_OTP_PENDING, "1");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
    } catch (error) {
      sessionStorage.removeItem(GOOGLE_OTP_PENDING);
      toast.error(error instanceof Error ? error.message : "Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border/60 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Stop the email that <span className="text-gradient-signal">breaks in.</span>
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            EmailDetection fuses a deterministic detection engine with explainable AI analysis —
            surfacing intent, indicators, URL structure and blast radius in seconds.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              "40+ heuristic phishing rules with weighted scoring",
              "Structural URL forensics and brand-impersonation checks",
              "Plain-English AI explanations you can send to staff",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Security operations · v1.0
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="glass-panel animate-rise rounded-2xl p-7">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "login" && "Sign in to your console"}
              {mode === "register" && "Create your account"}
              {mode === "forgot" && "Reset your password"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login" && "Enter your credentials to reach the threat dashboard."}
              {mode === "register" && "Start scanning suspicious email in under a minute."}
              {mode === "forgot" && "We'll email you a secure link to set a new password."}
            </p>

            {otpFlow ? (
              <form onSubmit={verifyCode} className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <strong>{otpEmail}</strong>.
                </p>
                <Label htmlFor="verification-code">Email verification code</Label>
                <Input id="verification-code" inputMode="numeric" autoComplete="one-time-code"
                  pattern="[0-9]{6}" maxLength={6} value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456" required />
                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify email & continue"}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={resendCode} disabled={loading}>
                  Resend verification code
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { setOtpFlow(null); setOtp(""); setMode("login"); }}>
                  Back to sign in
                </Button>
              </form>
            ) : sent === "confirm" ? (
              <div className="mt-6 rounded-xl border border-safe/40 bg-safe/10 p-4 text-sm text-foreground">
                Check <span className="font-medium">{email}</span> for a confirmation link. Once
                confirmed, sign in to reach your dashboard.
              </div>
            ) : sent === "reset" ? (
              <div className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
                A password reset link was sent to <span className="font-medium">{email}</span> if an
                account exists.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "register" && (
                  <Field
                    id="fullName"
                    label="Full name"
                    icon={UserRound}
                    value={fullName}
                    onChange={setFullName}
                    placeholder="Alex Mercer"
                    autoComplete="name"
                    required
                  />
                )}
                <Field
                  id="email"
                  label="Work email"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setMode("forgot")}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••"
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        required
                        minLength={8}
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>

                    {mode === "register" && password.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={cn(
                                "h-1.5 flex-1 rounded-full transition-colors",
                                i < strength.score
                                  ? STRENGTH_COLOR[strength.score]
                                  : "bg-muted",
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{strength.label}</span>
                          {strength.suggestions[0] ? ` — ${strength.suggestions[0]}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "login" && "Sign in"}
                      {mode === "register" && "Create account"}
                      {mode === "forgot" && "Send reset link"}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>

                {mode !== "forgot" && (
                  <>
                    <div className="relative py-1 text-center">
                      <span className="relative z-10 bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        or continue with
                      </span>
                      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogle}
                      disabled={loading}
                    >
                      <GoogleMark />
                      Google
                    </Button>
                  </>
                )}
              </form>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  New to EmailDetection?{" "}
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setMode("register");
                      setSent(null);
                    }}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setMode("login");
                      setSent(null);
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "id">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          {...rest}
        />
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.500-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8z" />
    </svg>
  );
}
