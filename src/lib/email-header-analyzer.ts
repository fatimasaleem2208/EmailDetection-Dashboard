/** Offline, client-side parsing of pasted RFC 5322-style headers.
 * This does not independently verify SPF, DKIM or DMARC with DNS or cryptography.
 */
export type HeaderFinding = { level: "warning" | "info" | "positive"; title: string; detail: string };
export type HeaderReport = {
  fields: Record<string, string[]>;
  from: string;
  replyTo: string;
  returnPath: string;
  messageId: string;
  receivedCount: number;
  spf: string;
  dkim: string;
  dmarc: string;
  findings: HeaderFinding[];
};

function addressDomain(value: string) {
  const matches = [...value.matchAll(/[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@([a-z0-9.-]+\.[a-z]{2,})/gi)];
  return matches.length ? matches[matches.length - 1][1].toLowerCase() : "";
}

export function analyzeEmailHeaders(raw: string): HeaderReport {
  if (raw.length > 200_000) throw new Error("Headers must be smaller than 200 KB.");
  const fields: Record<string, string[]> = {};
  const normalized = raw.replace(/\r\n?/g, "\n");
  let current = "";
  for (const line of normalized.split("\n")) {
    if (line === "") break; // stop at blank header/body separator
    if (/^[ \t]/.test(line) && current && fields[current]?.length) {
      const list = fields[current];
      list[list.length - 1] += " " + line.trim();
      continue;
    }
    const match = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (match) {
      current = match[1].toLowerCase();
      (fields[current] ??= []).push(match[2]);
    } else current = "";
  }
  const first = (name: string) => fields[name]?.[0] ?? "";
  const from = first("from"), replyTo = first("reply-to"), returnPath = first("return-path");
  const authResults = (fields["authentication-results"] ?? []).join("; ");
  const receivedSpf = (fields["received-spf"] ?? []).join("; ");
  const parseStatus = (key: string, text: string) => {
    const pattern = new RegExp(`(?:^|[;\\s])${key}\\s*=\\s*(pass|fail|softfail|neutral|none|temperror|permerror|policy|bestguesspass)`, "i");
    return text.match(pattern)?.[1].toLowerCase() ?? "not reported";
  };
  const spf = parseStatus("spf", authResults) !== "not reported" ? parseStatus("spf", authResults) : (receivedSpf.match(/^\s*(pass|fail|softfail|neutral|none|temperror|permerror)/i)?.[1].toLowerCase() ?? "not reported");
  const dkim = parseStatus("dkim", authResults);
  const dmarc = parseStatus("dmarc", authResults);
  const findings: HeaderFinding[] = [];
  if (!from) findings.push({level:"warning", title:"From header missing", detail:"No valid From field was found in the supplied text."});
  if (fields.from?.length > 1) findings.push({level:"warning", title:"Multiple From headers", detail:"More than one From header is unusual and can lead to ambiguous interpretation."});
  const fromDomain = addressDomain(from);
  const replyDomain = addressDomain(replyTo);
  const returnDomain = addressDomain(returnPath);
  if (fromDomain && replyDomain && fromDomain !== replyDomain) findings.push({level:"warning", title:"Reply-To differs from From", detail:`Visible sender domain ${fromDomain} differs from reply destination ${replyDomain}. This can be legitimate but warrants checking.`});
  if (fromDomain && returnDomain && fromDomain !== returnDomain) findings.push({level:"info", title:"Return-Path differs from From", detail:`Envelope sender domain ${returnDomain} differs from visible sender domain ${fromDomain}; third-party email services commonly do this.`});
  for (const [name, status] of [["SPF",spf], ["DKIM",dkim], ["DMARC",dmarc]]) {
    if (["fail","softfail","permerror"].includes(status)) findings.push({level:"warning",title:`${name} reported ${status}`,detail:`The pasted headers report ${name}=${status}. Confirm the results came from your trusted receiving mail system.`});
    if (status === "pass") findings.push({level:"positive",title:`${name} reported pass`,detail:`The pasted Authentication-Results report ${name}=pass. This alone does not prove the message is safe.`});
    if (status === "not reported") findings.push({level:"info",title:`${name} result unavailable`,detail:`No ${name} verdict found in the supplied headers; this is not equivalent to failure.`});
  }
  if (first("dkim-signature") && dkim === "not reported") findings.push({level:"info",title:"DKIM signature present",detail:"A DKIM-Signature header exists, but its presence does not verify that the signature passed."});
  if (!(fields.received?.length)) findings.push({level:"info",title:"Routing information unavailable",detail:"No Received headers were provided, so the delivery route cannot be reviewed."});
  return {fields, from, replyTo, returnPath, messageId:first("message-id"), receivedCount:fields.received?.length ?? 0, spf, dkim, dmarc, findings};
}
