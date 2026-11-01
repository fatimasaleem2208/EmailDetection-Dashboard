import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getProfile, updateSettings, deleteAccount } from "@/lib/profile.functions";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PhishGuard AI" },
      {
        name: "description",
        content: "Control appearance, notifications and account data in PhishGuard AI.",
      },
      { property: "og:title", content: "Settings — PhishGuard AI" },
      { property: "og:description", content: "Control your PhishGuard AI preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const fetchProfile = useServerFn(getProfile);
  const save = useServerFn(updateSettings);
  const removeAccount = useServerFn(deleteAccount);

  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (data?.profile) setNotifications(data.profile.notifications_enabled ?? true);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () =>
      save({
        data: { theme, notifications_enabled: notifications, language: "en" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Settings" description="Appearance, alerts and account controls.">
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-3xl space-y-4">
          <section className="glass-panel space-y-4 rounded-2xl p-6">
            <h2 className="text-sm font-semibold">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark security theme</Label>
                <p className="text-xs text-muted-foreground">
                  High-contrast console styling for low-light SOC work.
                </p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
          </section>

          <section className="glass-panel space-y-4 rounded-2xl p-6">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <div className="flex items-center justify-between">
              <div>
                <Label>Critical detection alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Show in-app alerts when a scan comes back critical.
                </p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save preferences
            </Button>
          </section>

          <section className="glass-panel space-y-3 rounded-2xl border-critical/40 p-6">
            <h2 className="text-sm font-semibold text-critical">Danger zone</h2>
            <p className="text-sm text-muted-foreground">
              Deleting your account permanently removes your profile, scan history, activity log and
              assistant conversations.
            </p>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!window.confirm("Permanently delete your account and all scan data?")) return;
                try {
                  await removeAccount();
                  await supabase.auth.signOut();
                  queryClient.clear();
                  navigate({ to: "/auth", replace: true });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Deletion failed");
                }
              }}
            >
              Delete my account
            </Button>
          </section>
        </div>
      )}
    </AppShell>
  );
}
