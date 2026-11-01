import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Indicator, UrlAnalysis } from "./phishing-engine";

export interface ReportScan {
  id: string;
  subject: string;
  sender: string | null;
  verdict: string;
  risk_score: number;
  confidence: number;
  threat_level: string;
  indicators: unknown;
  urls: unknown;
  recommendations: unknown;
  ai_explanation: string | null;
  created_at: string;
}

const INK = { r: 17, g: 24, b: 39 };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function downloadScanReport(scan: ReportScan) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;

  // Header band
  doc.setFillColor(13, 22, 38);
  doc.rect(0, 0, pageWidth, 92, "F");
  doc.setTextColor(94, 234, 212);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PhishGuard AI", margin, 42);
  doc.setTextColor(226, 232, 240);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Intelligent Phishing Email Detection — Analysis Report", margin, 60);
  doc.setFontSize(8);
  doc.text(`Report ID ${scan.id}`, margin, 76);
  doc.text(
    `Generated ${new Date().toLocaleString()}`,
    pageWidth - margin,
    76,
    { align: "right" },
  );

  const phishing = scan.verdict === "phishing";
  let y = 120;

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Verdict summary", margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 41, 59], textColor: [226, 232, 240] },
    head: [["Field", "Value"]],
    body: [
      ["Email subject", scan.subject || "(no subject)"],
      ["Sender", scan.sender || "(not supplied)"],
      ["Prediction", phishing ? "PHISHING" : "LEGITIMATE"],
      ["Risk score", `${scan.risk_score} / 100`],
      ["Confidence", `${Math.round(scan.confidence)}%`],
      ["Threat level", scan.threat_level.toUpperCase()],
      ["Scanned at", new Date(scan.created_at).toLocaleString()],
    ],
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;

  const indicators = asArray<Indicator>(scan.indicators);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Detected indicators", margin, y);
  autoTable(doc, {
    startY: y + 10,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [226, 232, 240] },
    head: [["Indicator", "Category", "Weight", "Evidence"]],
    body:
      indicators.length > 0
        ? indicators.map((i) => [i.title, i.category, String(i.weight), i.evidence ?? "—"])
        : [["No phishing indicators detected", "—", "—", "—"]],
    columnStyles: { 3: { cellWidth: 160 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;

  const urls = asArray<UrlAnalysis>(scan.urls);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Extracted URLs", margin, y);
  autoTable(doc, {
    startY: y + 10,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: [226, 232, 240] },
    head: [["URL", "Domain", "HTTPS", "Risk", "Status"]],
    body:
      urls.length > 0
        ? urls.map((u) => [u.url, u.domain, u.https ? "Yes" : "No", `${u.riskScore}`, u.status])
        : [["No URLs found in this message", "—", "—", "—", "—"]],
    columnStyles: { 0: { cellWidth: 200 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;

  if (y > 640) {
    doc.addPage();
    y = 60;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("AI explanation", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const explanation = doc.splitTextToSize(
    scan.ai_explanation ?? "No AI explanation was stored for this scan.",
    pageWidth - margin * 2,
  );
  doc.text(explanation, margin, y + 18);
  y += 18 + explanation.length * 13 + 20;

  if (y > 700) {
    doc.addPage();
    y = 60;
  }

  const recs = asArray<string>(scan.recommendations);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Security recommendations", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  let ry = y + 18;
  recs.forEach((rec, index) => {
    const lines = doc.splitTextToSize(`${index + 1}. ${rec}`, pageWidth - margin * 2 - 10);
    if (ry > 780) {
      doc.addPage();
      ry = 60;
    }
    doc.text(lines, margin, ry);
    ry += lines.length * 13 + 4;
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 150);
    doc.text(
      `PhishGuard AI — confidential security report — page ${p} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 22,
      { align: "center" },
    );
  }

  const safeName = (scan.subject || "scan").replace(/[^a-z0-9]+/gi, "-").slice(0, 40).toLowerCase();
  doc.save(`phishguard-report-${safeName || "scan"}.pdf`);
}

export function downloadCsv(rows: ReportScan[]) {
  const header = ["id", "subject", "sender", "verdict", "risk_score", "confidence", "threat_level", "created_at"];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [r.id, r.subject, r.sender, r.verdict, r.risk_score, r.confidence, r.threat_level, r.created_at]
        .map(escape)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `phishguard-scan-history-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
