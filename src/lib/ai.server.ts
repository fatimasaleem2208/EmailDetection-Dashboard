/**
 * Groq AI client (server-only).
 * Uses Groq's OpenAI-compatible Chat Completions API.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

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

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
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
    const detail = await response.text();

    console.error(
      "Groq API error",
      response.status,
      detail.slice(0, 500),
    );

    throw new AiGatewayError(
      "The AI service could not complete this request.",
      response.status,
    );
  }

  const payload = (await response.json()) as GroqResponse;

  const text = payload.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new AiGatewayError(
      "The AI service returned an empty response.",
      502,
    );
  }

  return text;
}
