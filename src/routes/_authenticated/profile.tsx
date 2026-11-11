import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProfile, updateProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — EmailDetection" },
      {
        name: "description",
        content: "Manage your EmailDetection display name, username and account overview.",
      },
      { property: "og:title", content: "Your Profile — EmailDetection" },
      { property: "og:description", content: "Manage your EmailDetection account details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const save = useServerFn(updateProfile);
  const { data, isLoading, error: profileError } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [displayRole, setDisplayRole] = useState("general_user");

  useEffect(() => {
    if (data?.profile) {
      setFullName(data.profile.full_name ?? "");
      setUsername(data.profile.username ?? "");
      setDisplayRole(data.profile.display_role ?? "general_user");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => save({ data: { full_name: fullName, username, display_role: displayRole as "general_user" | "security_analyst" | "it_professional" | "student" | "researcher" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Profile" description="Your analyst identity inside EmailDetection.">
      {profileError && <div role="alert" className="mb-4 rounded-xl border border-critical/40 p-3 text-sm text-critical">{profileError.message}</div>}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid max-w-4xl gap-4 lg:grid-cols-[1fr_280px]">
          <form
            className="glass-panel space-y-4 rounded-2xl p-6"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Mercer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="amercer"
              />
              <p className="text-xs text-muted-foreground">
                3–32 characters, letters, numbers, dots, dashes and underscores.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display-role">Professional role</Label>
              <Select value={displayRole} onValueChange={setDisplayRole}>
                <SelectTrigger id="display-role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_user">General User</SelectItem>
                  <SelectItem value="security_analyst">Security Analyst</SelectItem>
                  <SelectItem value="it_professional">IT Professional</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">This is a profile label, not an administrator permission.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Sign-in email (cannot be changed here)</Label>
              <Input id="email" value={data?.accountEmail ?? ""} readOnly disabled />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          </form>

          <aside className="glass-panel h-fit space-y-4 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary glow-ring">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">{fullName || "Analyst"}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {data?.accountEmail}
                </p>
              </div>
            </div>
            <div className="space-y-2 border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total scans</span>
                <span className="font-mono">{data?.totalScans ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className="text-xs">Authenticated</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Professional role</span>
                <span className="text-xs text-right">{({general_user:"General User",security_analyst:"Security Analyst",it_professional:"IT Professional",student:"Student",researcher:"Researcher"} as Record<string,string>)[displayRole] ?? "General User"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-mono text-xs">
                  {data?.joinedAt
                    ? new Date(data.joinedAt).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
