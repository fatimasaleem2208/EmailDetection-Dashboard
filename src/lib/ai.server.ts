/**
 * Server-only Gemini REST client.
 * Bounded retries on transient errors; never retries authentication/configuration errors.
 * A 429 daily quota failure may still require a quota reset or account change.
 */
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_MODEL = "gemini-3.5-flash";
const MAX_ATTEMPTS = 3; // initial request plus up to two retries
const MAX_RETRY_DELAY_MS = 4000;

export class AiGatewayError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AiGatewayError";
    this.status = status;
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number; status?: string };
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callAi(options: {
  instructions: string;
  input: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
}): Promise<string> {
  const key = process.env["GEMINI_API_KEY"]?.trim();
  if (!key) throw new AiGatewayError("AI is not configured. Set GEMINI_API_KEY on the server.", 503);

  const model = options.model ?? process.env["GEMINI_MODEL"]?.trim() ?? DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: options.instructions }] },
    contents: options.input.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    generationConfig: { temperature: 0.4 },
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: requestBody,
        signal: AbortSignal.timeout(25000),
      });
    } catch (error) {
      // No automatic retry on ambiguous network errors: the request may have reached Gemini.
      console.error("Gemini connection failed", error instanceof Error ? error.name : "unknown");
      throw new AiGatewayError("Could not connect to Gemini. Please retry your question.", 503);
    }

    if (!response.ok) {
      const status = response.status;
      // Do not log full provider error bodies or user prompts in server logs.
      console.error("Gemini request failed", { status, attempt: attempt + 1, model });
      if ((status === 429 || status === 503) && attempt < MAX_ATTEMPTS - 1) {
        const serverDelay = retryAfterMilliseconds(response.headers.get("retry-after"));
        // A long Retry-After indicates a quota window that won't reset inside this request.
        if (serverDelay === null || serverDelay <= MAX_RETRY_DELAY_MS) {
          await delay(Math.min(MAX_RETRY_DELAY_MS, serverDelay ?? 600 * 2 ** attempt));
          continue;
        }
      }
      if (status === 429) {
        throw new AiGatewayError("Gemini usage limit reached. Your question is still here. Please try again later.", 429);
      }
      if (status === 401 || status === 403) {
        throw new AiGatewayError("Gemini API access is not configured correctly. Contact the administrator.", 503);
      }
      if (status === 404) {
        throw new AiGatewayError(`Gemini model '${model}' is unavailable. Check GEMINI_MODEL.`, 503);
      }
      throw new AiGatewayError("Gemini could not complete this request. Please try again.", status >= 500 ? 503 : status);
    }

    let payload: GeminiResponse;
    try { payload = (await response.json()) as GeminiResponse; }
    catch { throw new AiGatewayError("Gemini returned an invalid response.", 502); }
    const answer = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!answer) throw new AiGatewayError("Gemini returned no text response.", 502);
    return answer;
  }
  throw new AiGatewayError("Gemini is temporarily unavailable.", 503);
}
