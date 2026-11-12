import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entrySchema = z.object({
  scanId: z.string().uuid(),
  scanType: z.enum(["email", "url", "attachment"]),
  starred: z.boolean(),
  label: z.string().trim().max(80),
  note: z.string().trim().max(1000),
});

export const listScanOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("scan_organization")
      .select("*").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(1000);
    if (error) throw new Error("Could not load saved labels. Check the scan organization SQL migration.");
    return data ?? [];
  });

export const saveScanOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => entrySchema.parse(input))
  .handler(async ({ data, context }) => {
    // Confirm ownership of the original scan before attaching labels/notes.
    if (data.scanType === "email") {
      const { data: scan, error } = await context.supabase.from("scans")
        .select("id").eq("id", data.scanId).eq("user_id", context.userId).maybeSingle();
      if (error || !scan) throw new Error("The email scan was not found in your history.");
    } else {
      const { data: scan, error } = await context.supabase.from("security_scan_history")
        .select("id, scan_type").eq("id", data.scanId).eq("user_id", context.userId).maybeSingle();
      if (error || !scan || scan.scan_type !== data.scanType) {
        throw new Error("The URL or attachment scan was not found in your history.");
      }
    }
    const { data: saved, error } = await context.supabase.from("scan_organization")
      .upsert({
        user_id: context.userId,
        scan_id: data.scanId,
        scan_type: data.scanType,
        starred: data.starred,
        label: data.label,
        note: data.note,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,scan_type,scan_id" }).select("*").single();
    if (error || !saved) throw new Error("Could not save scan organization. Check database permissions.");
    return saved;
  });
