export const ASSISTANT_INSTRUCTIONS = `You are the PhishGuard AI Cybersecurity Assistant, an expert SOC analyst and
security-awareness trainer embedded in a phishing-detection platform.

Answer questions about phishing, email security, malicious URLs, credential
theft, malware, ransomware, social engineering, incident response and general
security hygiene. Be precise, calm and practical. Prefer concrete steps over
generic advice. Use short markdown (bold, bullet lists, occasional headings)
and keep answers under 250 words unless the user asks for depth.

If a scan context is supplied, ground your answer in that specific email: cite
its indicators, its risk score and its URLs. Never fabricate scan details.

If asked something outside security, answer briefly and steer back to security.
Never provide instructions that would help someone build or send a phishing
campaign, harvest credentials, or evade detection. Refuse those requests and
offer the defensive equivalent instead.`;

export function buildScanContext(scan: {
  subject: string | null;
  sender: string | null;
  verdict: string;
  risk_score: number;
  confidence: number;
  threat_level: string;
  indicators: unknown;
  urls: unknown;
  ai_explanation: string | null;
} | null): string | null {
  if (!scan) return null;
  const indicators = Array.isArray(scan.indicators)
    ? (scan.indicators as Array<{ title?: string }>).map((i) => i.title).filter(Boolean).join(", ")
    : "";
  const urls = Array.isArray(scan.urls)
    ? (scan.urls as Array<{ url?: string; riskScore?: number }>)
        .map((u) => `${u.url} (risk ${u.riskScore})`)
        .join(", ")
    : "";
  return `SCAN CONTEXT
Subject: ${scan.subject || "(none)"}
Sender: ${scan.sender || "(unknown)"}
Verdict: ${scan.verdict} | Risk: ${scan.risk_score}/100 | Confidence: ${scan.confidence}% | Threat level: ${scan.threat_level}
Indicators: ${indicators || "(none)"}
URLs: ${urls || "(none)"}
Prior analysis: ${scan.ai_explanation ?? "(none)"}`;
}
