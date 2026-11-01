import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureUserSeeded } from "@/integrations/supabase/mock";
import { profileUpdateSchema, settingsUpdateSchema } from "@/lib/scan-schemas";

export const registerUserAccount = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string; fullName?: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const fullName = (data.fullName ?? "").trim();

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);
      if (existing) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: data.password,
          email_confirm: true,
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            ...(fullName ? { full_name: fullName } : {}),
          },
        });
        ensureUserSeeded({ id: existing.id, email, full_name: fullName });
        return { ok: true, userId: existing.id };
      }
      throw new Error(error.message);
    }

    if (created.user?.id) {
      ensureUserSeeded({ id: created.user.id, email, full_name: fullName });
    }

    return { ok: true, userId: created.user?.id ?? null };
  });

export const confirmExistingUser = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);
    if (existing && !existing.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
      });
    }
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profileRes, countRes, roleRes] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("scans")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    return {
      profile: profileRes.data,
      totalScans: countRes.count ?? 0,
      roles: (roleRes.data ?? []).map((r) => r.role),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => profileUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name, username: data.username })
      .eq("id", context.userId);
    if (error) {
      if (error.code === "23505") throw new Error("That username is already taken.");
      throw new Error("Could not update your profile.");
    }
    await context.supabase.from("activity_logs").insert({
      user_id: context.userId,
      action: "profile_updated",
      detail: "Profile details changed",
      severity: "info",
    });
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
