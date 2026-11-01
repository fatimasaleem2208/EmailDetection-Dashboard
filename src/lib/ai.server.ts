/**
 * Groq AI client (server-only).
 * Uses Groq's OpenAI-compatible Chat Completions API.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODELS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

export class AiGatewayError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

export async function callAi(options: {
  instructions: string;
  input: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
}): Promise<string> {
  const key = process.env["GROQ_API_KEY"];

  if (!key) {
    const lastInput = options.input[options.input.length - 1]?.content ?? "";
    if (lastInput.startsWith("VERDICT:")) {
      throw new AiGatewayError("AI service is not configured.", 500);
    }
    return `**PhishGuard SOC Guidance (Offline Heuristics Mode)**\n\nBased on your query:\n- **Verify Sender & Headers**: Always inspect the raw \`From\`, \`Reply-To\`, and \`Return-Path\` headers along with SPF, DKIM, and DMARC alignment.\n- **Inspect Embedded URLs**: Look for raw IP hosts, lookalike domains (typosquatting/homoglyphs), unencrypted HTTP login forms, and suspicious TLDs (\`.xyz\`, \`.top\`, \`.click\`).\n- **Recommended Action**: Never enter credentials via an emailed link. Navigate directly to the service via a known bookmark, quarantine suspicious messages, and report indicators of compromise (IOCs) to your security team.`;
  }

  const messages = [
    {
      role: "system" as const,
      content: options.instructions,
    },
    ...options.input,
  ];

  const modelsToTry = [
    options.model ?? DEFAULT_MODEL,
    ...FALLBACK_MODELS.filter((m) => m !== (options.model ?? DEFAULT_MODEL)),
  ];

  let lastStatus = 500;
  let lastDetail = "";

  for (const candidateModel of modelsToTry) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: candidateModel,
        messages,
        temperature: 0.2,
      }),
    });

    if (response.status === 429) {
      throw new AiGatewayError(
        "AI rate limit reached. Please try again in a moment.",
        429,
      );
    }

    if (!response.ok) {
      lastStatus = response.status;
      lastDetail = await response.text();
      console.warn(
        `Groq API model ${candidateModel} returned ${response.status}:`,
        lastDetail.slice(0, 300),
      );
      continue;
    }

    const payload = (await response.json()) as GroqResponse;
    const text = payload.choices?.[0]?.message?.content?.trim();

    if (text) {
      return text;
    }
  }

  console.error("Groq API error across all candidate models", lastStatus, lastDetail.slice(0, 500));
  throw new AiGatewayError(
    "The AI service could not complete this request.",
    lastStatus,
  );
}
