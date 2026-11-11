import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatInputSchema } from "@/lib/scan-schemas";
import { ASSISTANT_INSTRUCTIONS, buildScanContext } from "@/lib/assistant.server";
import { callAi, AiGatewayError } from "@/lib/ai.server";

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(200);
    return data ?? [];
  });

export const clearChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("chat_messages").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => chatInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(30);

    let scanContext: string | null = null;
    if (data.scanId) {
      const { data: scan } = await context.supabase
        .from("scans")
        .select(
          "subject, sender, verdict, risk_score, confidence, threat_level, indicators, urls, ai_explanation",
        )
        .eq("id", data.scanId)
        .eq("user_id", context.userId)
        .maybeSingle();
      scanContext = buildScanContext(scan);
    }

    const turns = (history ?? []).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
    turns.push({
      role: "user" as const,
      content: scanContext ? `${scanContext}\n\nQUESTION: ${data.message}` : data.message,
    });

    let reply: string;
    try {
      reply = await callAi({ instructions: ASSISTANT_INSTRUCTIONS, input: turns });
    } catch (error) {
      if (error instanceof AiGatewayError) throw new Error(error.message);
      throw new Error("The assistant is unavailable right now.");
    }

    const now = Date.now();
    const userMsg = {
      id: `user-${now}`,
      user_id: context.userId,
      role: "user",
      content: data.message,
      created_at: new Date(now).toISOString(),
    };
    const assistantMsg = {
      id: `assistant-${now + 1}`,
      user_id: context.userId,
      role: "assistant",
      content: reply,
      created_at: new Date(now + 1).toISOString(),
    };

    await context.supabase.from("chat_messages").insert([
      { user_id: context.userId, role: "user", content: data.message },
      { user_id: context.userId, role: "assistant", content: reply },
    ]);

    return { reply, userMessage: userMsg, assistantMessage: assistantMsg };
  });
