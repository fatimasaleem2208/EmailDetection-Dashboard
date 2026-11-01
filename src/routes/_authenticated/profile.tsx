import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProfile, updateProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — PhishGuard AI" },
      {
        name: "description",
        content: "Manage your PhishGuard AI display name, username and account overview.",
      },
      { property: "og:title", content: "Your Profile — PhishGuard AI" },
      { property: "og:description", content: "Manage your PhishGuard AI account details." },
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
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (data?.profile) {
      setFullName(data.profile.full_name ?? "");
      setUsername(data.profile.username ?? "");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => save({ data: { full_name: fullName, username } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Profile" description="Your analyst identity inside PhishGuard AI.">
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={data?.profile?.email ?? ""} disabled />
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
                  {data?.profile?.email}
                </p>
              </div>
            </div>
            <div className="space-y-2 border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total scans</span>
                <span className="font-mono">{data?.totalScans ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Roles</span>
                <span className="flex gap-1">
                  {(data?.roles ?? ["user"]).map((role) => (
                    <Badge key={role} variant="outline" className="text-[10px] uppercase">
                      {role}
                    </Badge>
                  ))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-mono text-xs">
                  {data?.profile?.created_at
                    ? new Date(data.profile.created_at).toLocaleDateString()
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
