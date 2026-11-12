import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(["accurate", "incorrect"]),
  reason: z.string().trim().max(800).default(""),
});

export const submitAiAnswerFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    // Current generated Supabase types predate the new feedback table.
    const db = context.supabase as unknown as SupabaseClient;
    const { data: message, error: readError } = await db
      .from("chat_messages")
      .select("id")
      .eq("id", data.messageId)
      .eq("user_id", context.userId)
      .eq("role", "assistant")
      .maybeSingle();
    if (readError || !message) throw new Error("AI response not found or not accessible.");

    const { error } = await db.from("ai_answer_feedback").upsert({
      user_id: context.userId,
      message_id: data.messageId,
      rating: data.rating,
      reason: data.rating === "incorrect" ? data.reason : "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,message_id" });
    if (error) {
      console.error("AI feedback save failed", { code: error.code });
      throw new Error("Could not save AI feedback. Check the database migration and permissions.");
    }
    return { ok: true };
  });
