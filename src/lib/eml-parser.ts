/**
 * Minimal RFC-822 / .eml + .txt parser for browser file uploads.
 * Extracts subject, sender, and body without any external dependency.
 */

export interface ParsedEmail {
  subject: string;
  sender: string;
  body: string;
  headerBlock: string;
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeEncodedWords(input: string): string {
  return input.replace(
    /=\?[^?]+\?([QqBb])\?([^?]*)\?=/g,
    (_, encoding: string, payload: string) => {
      try {
        if (encoding.toLowerCase() === "b") {
          return typeof atob === "function" ? atob(payload) : payload;
        }
        return decodeQuotedPrintable(payload.replace(/_/g, " "));
      } catch {
        return payload;
      }
    },
  );
}

function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseEmail(raw: string): ParsedEmail {
  const normalized = raw.replace(/\r\n/g, "\n");
  const splitIndex = normalized.indexOf("\n\n");
  const looksLikeHeaders = /^[A-Za-z-]+:\s/.test(normalized.trimStart());

  if (!looksLikeHeaders || splitIndex === -1) {
    return { subject: "", sender: "", body: normalized.trim(), headerBlock: "" };
  }

  const headerBlock = normalized.slice(0, splitIndex);
  let body = normalized.slice(splitIndex + 2);

  // Unfold folded header lines.
  const unfolded = headerBlock.replace(/\n[ \t]+/g, " ");
  const headerLines = unfolded.split("\n");
  const get = (name: string) => {
    const line = headerLines.find((l) => l.toLowerCase().startsWith(`${name}:`));
    return line ? decodeEncodedWords(line.slice(name.length + 1).trim()) : "";
  };

  const transferEncoding = get("content-transfer-encoding").toLowerCase();
  if (transferEncoding.includes("quoted-printable")) body = decodeQuotedPrintable(body);
  if (transferEncoding.includes("base64")) {
    try {
      body = typeof atob === "function" ? atob(body.replace(/\s/g, "")) : body;
    } catch {
      /* keep raw body */
    }
  }

  // If multipart, prefer the text/plain part, else strip the HTML part.
  const boundaryMatch = unfolded.match(/boundary="?([^";\s]+)"?/i);
  if (boundaryMatch?.[1]) {
    const parts = body.split(`--${boundaryMatch[1]}`);
    const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p));
    const html = parts.find((p) => /content-type:\s*text\/html/i.test(p));
    const chosen = plain ?? html;
    if (chosen) {
      const pIdx = chosen.indexOf("\n\n");
      let section = pIdx === -1 ? chosen : chosen.slice(pIdx + 2);
      if (/quoted-printable/i.test(chosen)) section = decodeQuotedPrintable(section);
      body = plain ? section : stripHtml(section);
    }
  } else if (/<html|<body|<div|<table/i.test(body)) {
    body = stripHtml(body);
  }

  const relevantHeaders = headerLines
    .filter((l) => /^(from|to|reply-to|return-path|received|subject|date|message-id|authentication-results|x-mailer|dkim-signature):/i.test(l))
    .join("\n");

  return {
    subject: get("subject"),
    sender: get("from"),
    body: `${relevantHeaders}\n\n${body}`.trim(),
    headerBlock: relevantHeaders,
  };
}
