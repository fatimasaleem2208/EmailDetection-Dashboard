/**
 * Gemini AI client (server-only).
 * Uses Google's Gemini generateContent REST API.
 * Never expose GEMINI_API_KEY in client-side code.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_MODEL = "gemini-3.5-flash";

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

export async function callAi(options: {
  instructions: string;
  input: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
}): Promise<string> {
  const key = process.env["GEMINI_API_KEY"]?.trim();
  if (!key) {
    throw new AiGatewayError("AI is not configured. Set GEMINI_API_KEY in your server environment.", 503);
  }

  const model = options.model ?? process.env["GEMINI_MODEL"]?.trim() ?? DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.instructions }] },
        contents: options.input.map((turn) => ({
          role: turn.role === "assistant" ? "model" : "user",
          parts: [{ text: turn.content }],
        })),
        generationConfig: { temperature: 0.4 },
      }),
    });
  } catch (error) {
    console.error("Gemini network request failed", error);
    throw new AiGatewayError("Could not connect to the AI service.", 503);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error(`Gemini API returned ${response.status}:`, detail);
    if (response.status === 429) {
      throw new AiGatewayError("Gemini rate limit reached. Please try again shortly.", 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new AiGatewayError("Gemini API key is invalid or lacks permission.", 503);
    }
    if (response.status === 404) {
      throw new AiGatewayError(`Gemini model '${model}' is unavailable for this API key. Check GEMINI_MODEL.`, 503);
    }
    throw new AiGatewayError("The AI service could not complete this request.", response.status);
  }

  const payload = (await response.json()) as GeminiResponse;
  const answer = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!answer) {
    throw new AiGatewayError("Gemini returned no text response.", 502);
  }
  return answer;
}
