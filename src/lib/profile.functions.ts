import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileUpdateSchema, settingsUpdateSchema } from "@/lib/scan-schemas";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profileRes, countRes] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("scans").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
    ]);
    if (profileRes.error) throw new Error(`Could not load profile: ${profileRes.error.message}`);
    if (countRes.error) throw new Error(`Could not count email scans: ${countRes.error.message}`);
    // Email comes from verified authentication claims, NOT an editable profile field.
    const accountEmail = typeof context.claims?.email === "string" ? context.claims.email : "";
    return {
      profile: profileRes.data,
      accountEmail,
      joinedAt: profileRes.data?.created_at ?? null,
      totalScans: countRes.count ?? 0,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => profileUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    // This updates a personal display label, never the Supabase authorization role.
    // Upsert repairs legacy accounts that have an auth.user but no profile row.
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      full_name: data.full_name,
      username: data.username,
      display_role: data.display_role,
    }, { onConflict: "id" });
    if (error) {
      if (error.code === "23505") throw new Error("That username is already taken.");
      throw new Error(`Could not update your profile: ${error.message}`);
    }
    const { error: logError } = await context.supabase.from("activity_logs").insert({
      user_id: context.userId,
      action: "profile_updated",
      detail: "Profile details changed",
      severity: "info",
    });
    if (logError) console.error("profile activity log failed", logError);
    return { ok: true };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => settingsUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        theme: data.theme,
        notifications_enabled: data.notifications_enabled,
        language: data.language,
      })
      .eq("id", context.userId);
    if (error) throw new Error("Could not save your settings.");
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Could not delete your account.");
    return { ok: true };
  });

export const logActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { action: string; detail?: string; severity?: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase.from("activity_logs").insert({
      user_id: context.userId,
      action: data.action.slice(0, 64),
      detail: (data.detail ?? "").slice(0, 300),
      severity: data.severity ?? "info",
    });
    return { ok: true };
  });
