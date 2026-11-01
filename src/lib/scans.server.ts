/**
 * Server-only helpers for scan persistence and AI explanation.
 */
import { analyzeEmail, type AnalysisResult } from "./phishing-engine";
import { callAi } from "./ai.server";

const EXPLAIN_INSTRUCTIONS = `You are PhishGuard AI, a senior email-security analyst.
You receive a deterministic heuristic verdict plus the email. Write a concise
explainable-AI narrative for a non-expert, in plain prose (no markdown headings,
no bullet characters). Structure: 2-4 short paragraphs, under 180 words total.
Explain WHY the verdict was reached, name the specific techniques used
(urgency, credential harvesting, brand impersonation, lookalike domains, etc.),
quote short fragments of the email as evidence, and end with the single most
important action for the reader. Never invent indicators that were not supplied.
Never claim certainty beyond the given confidence.`;

export async function explainWithAi(
  email: { subject: string; sender: string; body: string },
  result: AnalysisResult,
): Promise<string | null> {
  const indicatorList = result.indicators
    .map((i) => `- ${i.title} (weight ${i.weight})${i.evidence ? ` | evidence: "${i.evidence}"` : ""}`)
    .join("\n");
  const urlList = result.urls
    .map((u) => `- ${u.url} | risk ${u.riskScore}/100 | ${u.reasons.join(" ")}`)
    .join("\n");

  const prompt = `VERDICT: ${result.verdict.toUpperCase()}
RISK SCORE: ${result.riskScore}/100
CONFIDENCE: ${result.confidence}%
THREAT LEVEL: ${result.threatLevel}

DETECTED INDICATORS:
${indicatorList || "(none)"}

URL ANALYSIS:
${urlList || "(no URLs)"}

HEADER NOTES:
${result.headers.notes.join(" ")}

EMAIL SUBJECT: ${email.subject || "(none)"}
EMAIL SENDER: ${email.sender || "(not supplied)"}
EMAIL BODY (truncated):
${email.body.slice(0, 4000)}`;

  try {
    return await callAi({
      instructions: EXPLAIN_INSTRUCTIONS,
      input: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    console.error("AI explanation failed", error);
    return null;
  }
}

export function fallbackExplanation(result: AnalysisResult): string {
  if (result.indicators.length === 0) {
    return "No known phishing techniques were detected in this message. The language, structure and any embedded links all scored within normal ranges. Continue to treat unexpected requests with care.";
  }
  const top = result.indicators.slice(0, 4).map((i) => i.title.toLowerCase());
  return `This message was classified as ${result.verdict} with a risk score of ${result.riskScore}/100 (${result.threatLevel} threat level). The strongest signals were ${top.join(", ")}. ${
    result.urls.length > 0
      ? `It contains ${result.urls.length} link${result.urls.length > 1 ? "s" : ""}, the riskiest scoring ${Math.max(...result.urls.map((u) => u.riskScore))}/100.`
      : "No links were embedded in the message."
  } ${result.recommendations[0] ?? ""}`;
}

export function runAnalysis(input: { subject: string; sender: string; body: string }) {
  return analyzeEmail({ subject: input.subject, body: input.body, sender: input.sender });
}
