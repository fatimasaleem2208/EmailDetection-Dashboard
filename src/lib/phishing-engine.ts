/**
 * PhishGuard AI — heuristic detection engine.
 *
 * Pure, deterministic, dependency-free scoring of an email. Runs identically on
 * the server (scan persistence) and the client (instant previews). The AI layer
 * on top of this engine adds narrative explanation, never the verdict itself.
 */

export type ThreatLevel = "low" | "medium" | "high" | "critical";
export type Verdict = "legitimate" | "phishing";

export interface Indicator {
  id: string;
  title: string;
  detail: string;
  category:
    | "urgency"
    | "credentials"
    | "social"
    | "url"
    | "sender"
    | "content"
    | "attachment";
  weight: number;
  evidence?: string | undefined;
}

export interface UrlAnalysis {
  url: string;
  domain: string;
  https: boolean;
  isIpAddress: boolean;
  isShortened: boolean;
  suspiciousTld: boolean;
  subdomainCount: number;
  length: number;
  hasAtSymbol: boolean;
  hasPunycode: boolean;
  hasCredentialPath: boolean;
  brandImpersonation: string | null;
  riskScore: number;
  status: "safe" | "suspicious" | "dangerous" | "high risk";
  reasons: string[];
}

export interface EmailHeaderAnalysis {
  from: string | null;
  replyTo: string | null;
  returnPath: string | null;
  displayNameMismatch: boolean;
  replyToMismatch: boolean;
  freeMailSender: boolean;
  notes: string[];
}

export interface Iocs {
  domains: string[];
  ips: string[];
  emails: string[];
  urls: string[];
}

export interface AnalysisResult {
  verdict: Verdict;
  riskScore: number;
  confidence: number;
  threatLevel: ThreatLevel;
  indicators: Indicator[];
  urls: UrlAnalysis[];
  headers: EmailHeaderAnalysis;
  iocs: Iocs;
  recommendations: string[];
  clickImpact: { title: string; detail: string }[];
  reputation: { score: number; label: string };
}

const SHORTENERS = [
  "bit.ly","tinyurl.com","goo.gl","t.co","ow.ly","is.gd","buff.ly","cutt.ly",
  "rebrand.ly","shorturl.at","rb.gy","tiny.cc","bl.ink","s.id","lnkd.in",
];

const SUSPICIOUS_TLDS = [
  "zip","mov","xyz","top","tk","ml","ga","cf","gq","work","click","link","rest",
  "country","stream","download","loan","review","kim","men","party","date","racing",
];

const FREE_MAIL = [
  "gmail.com","yahoo.com","hotmail.com","outlook.com","aol.com","mail.ru",
  "protonmail.com","gmx.com","yandex.com","icloud.com",
];

const BRANDS = [
  "paypal","microsoft","office365","apple","icloud","amazon","netflix","google",
  "facebook","instagram","linkedin","dhl","fedex","ups","hsbc","chase","wellsfargo",
  "barclays","dropbox","docusign","adobe","binance","coinbase","whatsapp","steam",
];

interface Rule {
  id: string;
  title: string;
  category: Indicator["category"];
  weight: number;
  patterns: RegExp[];
  detail: string;
}

const CONTENT_RULES: Rule[] = [
  {
    id: "urgency",
    title: "Urgency and time pressure",
    category: "urgency",
    weight: 14,
    detail:
      "The message pressures the reader to act immediately, a hallmark of phishing designed to bypass careful thinking.",
    patterns: [
      /\b(urgent|immediately|right away|as soon as possible|asap|act now|last warning|final notice)\b/i,
      /\bwithin (24|48|12|72) hours?\b/i,
      /\b(expires?|expiring|deadline) (today|tomorrow|soon|shortly)\b/i,
      /\bdo not ignore\b/i,
    ],
  },
  {
    id: "account_threat",
    title: "Account suspension or closure threat",
    category: "social",
    weight: 16,
    detail:
      "The email threatens loss of access to an account or service to provoke a panicked response.",
    patterns: [
      /\b(account|profile|mailbox|access) (has been |will be |is )?(suspend|suspended|disabled|deactivated|locked|closed|terminated|restricted)/i,
      /\bunusual (sign[- ]?in|login|activity)\b/i,
      /\bsecurity (alert|breach|violation) (detected|on your account)\b/i,
    ],
  },
  {
    id: "credential_request",
    title: "Credential harvesting attempt",
    category: "credentials",
    weight: 22,
    detail:
      "The message asks the recipient to sign in, verify, or re-enter credentials — the core mechanic of credential theft.",
    patterns: [
      /\b(verify|confirm|update|re-?enter|re-?activate|validate) your (account|password|identity|login|credentials|details|information)\b/i,
      /\b(sign|log) ?in (here|now|to (verify|confirm|restore))\b/i,
      /\bclick (here|the link|below) to (login|log in|sign in|verify|unlock|restore)\b/i,
      /\bupdate your (payment|billing) (details|information|method)\b/i,
    ],
  },
  {
    id: "confidential_data",
    title: "Requests confidential information",
    category: "credentials",
    weight: 20,
    detail:
      "Sensitive data is solicited directly in the message. Legitimate organisations never request this by email.",
    patterns: [
      /\b(social security|ssn|national insurance|passport number|cnic)\b/i,
      /\b(credit ?card|card number|cvv|cvc|pin code|routing number|iban)\b/i,
      /\b(otp|one[- ]time (code|password)|2fa code|verification code)\b/i,
      /\b(send|share|provide|reply with) (your|the) (password|credentials|pin)\b/i,
    ],
  },
  {
    id: "generic_greeting",
    title: "Generic or impersonal greeting",
    category: "content",
    weight: 8,
    detail:
      "A mass-mailed greeting instead of your name suggests the sender does not actually know the recipient.",
    patterns: [
      /^\s*(dear )?(customer|user|client|member|account holder|sir\/madam|valued customer)\b/im,
      /\bdear (email )?(user|customer)\b/i,
    ],
  },
  {
    id: "fear_tactics",
    title: "Fear and intimidation tactics",
    category: "social",
    weight: 13,
    detail:
      "Threatening consequences such as legal action, fines, or exposure is a coercion technique.",
    patterns: [
      /\b(legal action|lawsuit|prosecut(e|ion)|police|court|fine|penalt(y|ies))\b/i,
      /\b(we have|i have) (recorded|access to|footage of)\b/i,
      /\byour (data|files|photos) (will be|have been) (leaked|published|encrypted)\b/i,
    ],
  },
  {
    id: "reward_lure",
    title: "Too-good-to-be-true reward",
    category: "social",
    weight: 12,
    detail:
      "Prizes, refunds, and unexpected payouts are classic bait used to get a click.",
    patterns: [
      /\b(you (have )?(won|are the winner)|congratulations)\b/i,
      /\b(refund|reimbursement|compensation|cash ?prize|gift ?card|lottery|inheritance)\b/i,
      /\b(claim|collect) your (prize|reward|refund|payment)\b/i,
      /\b(bitcoin|crypto|investment) (opportunity|profit|double)\b/i,
    ],
  },
  {
    id: "invoice_lure",
    title: "Unexpected invoice or payment lure",
    category: "social",
    weight: 11,
    detail:
      "Fake invoices and payment notices are used to trigger urgency and open malicious attachments.",
    patterns: [
      /\b(invoice|receipt|purchase order|payment (due|failed|declined)|overdue)\b/i,
      /\b(wire|bank) transfer\b/i,
      /\bupdate (the )?bank (account )?details\b/i,
    ],
  },
  {
    id: "delivery_lure",
    title: "Parcel or delivery pretext",
    category: "social",
    weight: 9,
    detail:
      "Delivery-failure notices are among the most abused phishing pretexts worldwide.",
    patterns: [
      /\b(parcel|package|shipment|delivery) (failed|on hold|pending|could not be delivered)\b/i,
      /\bcustoms (fee|clearance|charge)\b/i,
      /\breschedule (your )?delivery\b/i,
    ],
  },
  {
    id: "secrecy",
    title: "Requests secrecy or bypasses process",
    category: "social",
    weight: 12,
    detail:
      "Asking the recipient to keep the request quiet is typical of business email compromise (BEC).",
    patterns: [
      /\b(keep this (confidential|between us)|do not (tell|inform|discuss)|don'?t tell anyone)\b/i,
      /\bi'?m (currently )?in a meeting\b/i,
      /\b(handle|process) this (discreetly|quietly)\b/i,
    ],
  },
  {
    id: "attachment_risk",
    title: "Risky attachment referenced",
    category: "attachment",
    weight: 15,
    detail:
      "The message references an executable, macro-enabled, or archive attachment commonly used to deliver malware.",
    patterns: [
      /\battach(ed|ment)s?\b[^.]{0,60}\.(exe|scr|js|vbs|jar|bat|cmd|iso|img|docm|xlsm|pptm|7z|rar|zip|html?)\b/i,
      /\.(exe|scr|vbs|jar|bat|cmd|docm|xlsm|iso)\b/i,
      /\benable (macros|editing|content)\b/i,
    ],
  },
  {
    id: "poor_language",
    title: "Language and formatting anomalies",
    category: "content",
    weight: 6,
    detail:
      "Spelling errors, odd grammar, or shouting capitals often indicate a hastily built phishing template.",
    patterns: [
      /\b(kindly (do the needful|revert)|please to|informations|verifcation|acount|securty|immediatly|recieve)\b/i,
      /[A-Z]{6,}\b.*[A-Z]{6,}/,
      /!{3,}/,
    ],
  },
  {
    id: "spoof_language",
    title: "Claims to be an official security team",
    category: "sender",
    weight: 10,
    detail:
      "Impersonating an IT, security, or support desk lends false authority to the request.",
    patterns: [
      /\b(it (help ?desk|support|department)|security team|system administrator|webmail admin|service desk)\b/i,
      /\b(microsoft|google|apple|paypal|amazon) (support|security|team)\b/i,
    ],
  },
];

const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function extractUrls(text: string): string[] {
  const found = text.match(URL_REGEX) ?? [];
  const cleaned = found.map((u) => u.replace(/[.,;:]+$/, ""));
  return Array.from(new Set(cleaned));
}

export function analyzeUrl(raw: string): UrlAnalysis {
  const normalized = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let host = "";
  let pathname = "";
  let protocol = "http:";
  try {
    const parsed = new URL(normalized);
    host = parsed.hostname.toLowerCase();
    pathname = `${parsed.pathname}${parsed.search}`.toLowerCase();
    protocol = parsed.protocol;
  } catch {
    host = raw.toLowerCase();
  }

  const reasons: string[] = [];
  let score = 0;

  const https = protocol === "https:";
  if (!https) {
    score += 18;
    reasons.push("No HTTPS — traffic to this host is not encrypted.");
  }

  const isIpAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (isIpAddress) {
    score += 32;
    reasons.push("Raw IP address used instead of a domain name.");
  }

  const isShortened = SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`));
  if (isShortened) {
    score += 24;
    reasons.push("URL shortener hides the real destination.");
  }

  const tld = host.split(".").pop() ?? "";
  const suspiciousTld = SUSPICIOUS_TLDS.includes(tld);
  if (suspiciousTld) {
    score += 22;
    reasons.push(`Low-reputation top-level domain (.${tld}).`);
  }

  const labels = host.split(".").filter(Boolean);
  const subdomainCount = Math.max(0, labels.length - 2);
  if (subdomainCount >= 3) {
    score += 18;
    reasons.push(`Deep subdomain chain (${subdomainCount} levels) used to look legitimate.`);
  } else if (subdomainCount === 2) {
    score += 8;
    reasons.push("Multiple subdomains present.");
  }

  const length = raw.length;
  if (length > 120) {
    score += 14;
    reasons.push("Unusually long URL, often used to bury the real target.");
  } else if (length > 75) {
    score += 7;
    reasons.push("Longer than typical legitimate links.");
  }

  const hasAtSymbol = raw.includes("@");
  if (hasAtSymbol) {
    score += 26;
    reasons.push("Contains '@', which can mask the true destination host.");
  }

  const hasPunycode = host.startsWith("xn--") || host.includes(".xn--");
  if (hasPunycode) {
    score += 28;
    reasons.push("Punycode domain — may visually imitate a trusted brand.");
  }

  const hasCredentialPath =
    /(login|signin|sign-in|verify|secure|account|update|confirm|password|webscr|banking|wallet)/.test(
      pathname,
    ) || /(login|signin|verify|secure|account)/.test(host);
  if (hasCredentialPath) {
    score += 14;
    reasons.push("Path or host advertises a login/verification page.");
  }

  let brandImpersonation: string | null = null;
  for (const brand of BRANDS) {
    if (!host.includes(brand)) continue;
    const registrable = labels.slice(-2).join(".");
    if (!registrable.startsWith(`${brand}.`) && registrable !== `${brand}.com`) {
      brandImpersonation = brand;
      score += 30;
      reasons.push(`Impersonates "${brand}" outside its official domain.`);
      break;
    }
  }

  if (/-{2,}|\d{4,}/.test(labels[0] ?? "")) {
    score += 6;
    reasons.push("Randomised-looking hostname.");
  }

  if (reasons.length === 0) reasons.push("No structural red flags detected.");

  const riskScore = clamp(Math.round(score));
  const status: UrlAnalysis["status"] =
    riskScore >= 75 ? "high risk" : riskScore >= 50 ? "dangerous" : riskScore >= 25 ? "suspicious" : "safe";

  return {
    url: raw,
    domain: host,
    https,
    isIpAddress,
    isShortened,
    suspiciousTld,
    subdomainCount,
    length,
    hasAtSymbol,
    hasPunycode,
    hasCredentialPath,
    brandImpersonation,
    riskScore,
    status,
    reasons,
  };
}

function analyzeHeaders(sender: string | null, body: string): EmailHeaderAnalysis {
  const replyToMatch = body.match(/^reply-to:\s*(.+)$/im);
  const returnPathMatch = body.match(/^return-path:\s*(.+)$/im);
  const replyTo = replyToMatch?.[1]?.trim() ?? null;
  const returnPath = returnPathMatch?.[1]?.trim() ?? null;
  const notes: string[] = [];

  const senderEmail = sender?.match(EMAIL_REGEX)?.[0]?.toLowerCase() ?? null;
  const senderDomain = senderEmail?.split("@")[1] ?? null;
  const displayName = sender?.replace(/<[^>]*>/, "").replace(/["']/g, "").trim() ?? "";

  let displayNameMismatch = false;
  if (senderDomain && displayName) {
    const brandInName = BRANDS.find((b) => displayName.toLowerCase().includes(b));
    if (brandInName && !senderDomain.includes(brandInName)) {
      displayNameMismatch = true;
      notes.push(
        `Display name claims "${brandInName}" but the address is @${senderDomain}.`,
      );
    }
  }

  let replyToMismatch = false;
  const replyDomain = replyTo?.match(EMAIL_REGEX)?.[0]?.split("@")[1]?.toLowerCase() ?? null;
  if (replyDomain && senderDomain && replyDomain !== senderDomain) {
    replyToMismatch = true;
    notes.push(`Reply-To (@${replyDomain}) differs from the From domain (@${senderDomain}).`);
  }

  const freeMailSender = !!senderDomain && FREE_MAIL.includes(senderDomain);
  if (freeMailSender) {
    notes.push(`Sender uses a free mail provider (${senderDomain}) rather than a corporate domain.`);
  }

  const returnDomain = returnPath?.match(EMAIL_REGEX)?.[0]?.split("@")[1]?.toLowerCase() ?? null;
  if (returnDomain && senderDomain && returnDomain !== senderDomain) {
    notes.push(`Return-Path domain (@${returnDomain}) does not match the sender domain.`);
  }

  if (!senderEmail) notes.push("No sender address supplied — origin cannot be verified.");
  if (notes.length === 0) notes.push("No header anomalies detected in the supplied data.");

  return {
    from: senderEmail,
    replyTo,
    returnPath,
    displayNameMismatch,
    replyToMismatch,
    freeMailSender,
    notes,
  };
}

function buildClickImpact(urls: UrlAnalysis[], indicators: Indicator[]) {
  const impacts: { title: string; detail: string }[] = [];
  const has = (id: string) => indicators.some((i) => i.id === id);
  const worst = urls.reduce((m, u) => Math.max(m, u.riskScore), 0);

  if (has("credential_request") || urls.some((u) => u.hasCredentialPath)) {
    impacts.push({
      title: "Credential theft",
      detail:
        "You would land on a pixel-perfect clone of a real login page. Anything typed there is captured instantly and replayed against the genuine service.",
    });
    impacts.push({
      title: "Session hijacking",
      detail:
        "Modern phishing kits proxy your login in real time, stealing the session cookie so multi-factor prompts are passed on your behalf.",
    });
  }
  if (has("attachment_risk") || worst >= 60) {
    impacts.push({
      title: "Malware installation",
      detail:
        "A drive-by download or a macro-enabled document can silently install a loader that gives an attacker remote control of the device.",
    });
    impacts.push({
      title: "Ransomware deployment",
      detail:
        "That loader is frequently the first stage of a ransomware operation which encrypts local and network files.",
    });
  }
  if (has("confidential_data") || has("invoice_lure")) {
    impacts.push({
      title: "Banking and payment fraud",
      detail:
        "Submitted card, IBAN, or OTP data is used within minutes to authorise transfers or to redirect legitimate invoice payments.",
    });
  }
  if (urls.some((u) => u.isShortened || u.hasAtSymbol || u.hasPunycode)) {
    impacts.push({
      title: "Redirect to a fake login page",
      detail:
        "The visible link is not the destination. A chain of redirects ends on attacker-controlled infrastructure that mimics a brand you trust.",
    });
  }
  if (worst >= 40) {
    impacts.push({
      title: "Cookie and token theft",
      detail:
        "Malicious scripts on the landing page attempt to read browser storage and exfiltrate authentication tokens for other sites.",
    });
    impacts.push({
      title: "Spyware and keylogging",
      detail:
        "Persistent spyware can record keystrokes, screenshots, and clipboard contents, including passwords typed later.",
    });
  }
  if (has("account_threat")) {
    impacts.push({
      title: "Account takeover",
      detail:
        "With valid credentials the attacker changes recovery details and locks you out, then pivots to mailboxes, cloud drives, and colleagues.",
    });
  }
  return impacts.slice(0, 8);
}

function buildRecommendations(result: {
  verdict: Verdict;
  riskScore: number;
  indicators: Indicator[];
  urls: UrlAnalysis[];
}): string[] {
  const recs: string[] = [];
  if (result.verdict === "phishing") {
    recs.push("Do not click any link or open any attachment in this message.");
    recs.push("Report the email to your security team or use your mail client's Report Phishing action.");
    recs.push("Delete the message and remove it from the deleted-items folder.");
  } else {
    recs.push("No action required, but stay alert for follow-up messages referencing this thread.");
  }
  recs.push("Verify the sender through a channel you already trust — never a number or link inside the email.");
  if (result.indicators.some((i) => i.category === "credentials")) {
    recs.push("If you already entered credentials, change that password immediately and everywhere it was reused.");
    recs.push("Enable multi-factor authentication (prefer an authenticator app or hardware key over SMS).");
  }
  if (result.urls.length > 0) {
    recs.push("Inspect links by hovering to reveal the true destination before ever clicking.");
  }
  if (result.indicators.some((i) => i.category === "attachment")) {
    recs.push("Never enable macros or 'editing' on an unexpected document; scan attachments in isolation.");
  }
  if (result.riskScore >= 80) {
    recs.push("Treat the device as potentially exposed: run a full endpoint scan and review recent sign-in activity.");
  }
  return recs;
}

export function analyzeEmail(input: {
  subject: string;
  body: string;
  sender?: string | null;
}): AnalysisResult {
  const subject = input.subject ?? "";
  const body = input.body ?? "";
  const sender = input.sender?.trim() || null;
  const haystack = `${subject}\n${body}`;

  const indicators: Indicator[] = [];
  for (const rule of CONTENT_RULES) {
    for (const pattern of rule.patterns) {
      const match = haystack.match(pattern);
      if (match) {
        indicators.push({
          id: rule.id,
          title: rule.title,
          detail: rule.detail,
          category: rule.category,
          weight: rule.weight,
          evidence: match[0].slice(0, 120),
        });
        break;
      }
    }
  }

  const urlStrings = extractUrls(haystack);
  const urls = urlStrings.map(analyzeUrl);
  const headers = analyzeHeaders(sender, body);

  let score = indicators.reduce((sum, i) => sum + i.weight, 0);

  const worstUrl = urls.reduce((m, u) => Math.max(m, u.riskScore), 0);
  if (urls.length > 0) {
    score += worstUrl * 0.45;
    if (urls.length > 4) score += 6;
    const risky = urls.filter((u) => u.riskScore >= 50);
    if (risky.length > 0) {
      indicators.push({
        id: "suspicious_url",
        title: "Suspicious URL detected",
        detail: `${risky.length} link${risky.length > 1 ? "s" : ""} scored as dangerous or high risk during structural analysis.`,
        category: "url",
        weight: 18,
        evidence: risky[0]?.url.slice(0, 120),
      });
    }
  }

  if (headers.displayNameMismatch) {
    score += 20;
    indicators.push({
      id: "display_name_spoof",
      title: "Sender display-name spoofing",
      detail: "The friendly name impersonates a brand that does not own the sending domain.",
      category: "sender",
      weight: 20,
      evidence: sender ?? undefined,
    });
  }
  if (headers.replyToMismatch) {
    score += 16;
    indicators.push({
      id: "reply_to_mismatch",
      title: "Reply-To mismatch",
      detail: "Replies would be routed to a different domain than the apparent sender.",
      category: "sender",
      weight: 16,
      evidence: headers.replyTo ?? undefined,
    });
  }
  if (headers.freeMailSender && indicators.some((i) => i.category !== "content")) {
    score += 8;
  }

  if (body.trim().length < 40 && urls.length > 0) {
    score += 8;
    indicators.push({
      id: "thin_body",
      title: "Near-empty body with a link",
      detail: "A message that is little more than a link is a common lure pattern.",
      category: "content",
      weight: 8,
    });
  }

  const riskScore = clamp(Math.round(score));
  const verdict: Verdict = riskScore >= 45 ? "phishing" : "legitimate";
  const threatLevel: ThreatLevel =
    riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 35 ? "medium" : "low";

  const distance = Math.abs(riskScore - 45);
  const confidence = clamp(Math.round(55 + distance * 0.85 + Math.min(indicators.length, 6) * 2), 50, 99);

  const iocs: Iocs = {
    domains: Array.from(new Set(urls.map((u) => u.domain).filter(Boolean))),
    ips: Array.from(new Set(haystack.match(IP_REGEX) ?? [])),
    emails: Array.from(new Set((haystack.match(EMAIL_REGEX) ?? []).map((e) => e.toLowerCase()))),
    urls: urlStrings,
  };

  const reputationScore = clamp(100 - riskScore);
  const reputation = {
    score: reputationScore,
    label:
      reputationScore >= 80
        ? "Trusted"
        : reputationScore >= 60
          ? "Neutral"
          : reputationScore >= 35
            ? "Questionable"
            : "Malicious",
  };

  const sorted = indicators.sort((a, b) => b.weight - a.weight);

  return {
    verdict,
    riskScore,
    confidence,
    threatLevel,
    indicators: sorted,
    urls,
    headers,
    iocs,
    recommendations: buildRecommendations({ verdict, riskScore, indicators: sorted, urls }),
    clickImpact: buildClickImpact(urls, sorted),
    reputation,
  };
}

export const THREAT_META: Record<
  ThreatLevel,
  { label: string; token: string; ring: string; text: string }
> = {
  low: { label: "Low", token: "bg-safe", ring: "border-safe/40", text: "text-safe" },
  medium: { label: "Medium", token: "bg-caution", ring: "border-caution/40", text: "text-caution" },
  high: { label: "High", token: "bg-warning", ring: "border-warning/40", text: "text-warning" },
  critical: { label: "Critical", token: "bg-critical", ring: "border-critical/40", text: "text-critical" },
};
