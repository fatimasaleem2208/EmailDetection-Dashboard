import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface SecurityReportRecord {
  id: string;
  scan_type: "url" | "attachment";
  target: string;
  risk_level: string;
  risk_score: number | null;
  findings: unknown;
  details: unknown;
  created_at: string;
}

export function downloadSecurityReport(scan: SecurityReportRecord) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 44;
  doc.setFillColor(13, 22, 38);
  doc.rect(0, 0, w, 98, "F");
  doc.setTextColor(94, 234, 212);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("EmailDetection", margin, 40);
  doc.setFontSize(11); doc.setTextColor(232, 240, 246);
  doc.text(`${scan.scan_type === "url" ? "URL & Domain" : "Attachment"} — Security Analysis Report`, margin, 61);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Report ${scan.id}`, margin, 79);
  doc.setTextColor(20, 30, 40);
  autoTable(doc, {
    startY: 119,
    head: [["Field", "Value"]],
    body: [
      ["Scan type", scan.scan_type.toUpperCase()],
      ["Target", scan.target],
      ["Risk level", scan.risk_level.toUpperCase()],
      ["Structural risk", scan.risk_score === null ? "Not scored" : `${scan.risk_score} / 100`],
      ["Analyzed", new Date(scan.created_at).toLocaleString()],
      ["Report generated", new Date().toLocaleString()],
    ],
    theme: "grid", styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59] }, margin: { left: margin, right: margin },
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 25;
  const findings = Array.isArray(scan.findings) ? scan.findings.map(String) : [];
  autoTable(doc, {
    startY: y,
    head: [["Finding", "Explanation"]],
    body: findings.length ? findings.map((x, i) => [String(i + 1), x]) : [["—", "No static warning signs recorded"]],
    theme: "striped", styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59] }, margin: { left: margin, right: margin },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 25;
  const details = scan.details && typeof scan.details === "object" && !Array.isArray(scan.details)
    ? Object.entries(scan.details) : [];
  if (details.length) {
    autoTable(doc, {
      startY: y,
      head: [["Additional check", "Recorded result"]],
      body: details.map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
      theme: "striped", styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59] }, margin: { left: margin, right: margin },
    });
  }
  doc.addPage();
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Interpretation and limitations", margin, 65);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const notice = "Risk scoring describes heuristic warning signs, not the probability that an item is malicious. An unflagged URL or file is not guaranteed safe. Reputation checks may be missing, delayed, or inconclusive. This report reflects the recorded assessment and is not a substitute for sandbox or forensic analysis. Do not execute suspicious attachments or open suspicious URLs to verify them.";
  doc.text(doc.splitTextToSize(notice, w - margin * 2), margin, 88);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(110, 120, 135);
    doc.text(`EmailDetection | Report ${scan.id.slice(0, 8)} | Page ${p}/${pages}`,
      w / 2, doc.internal.pageSize.getHeight() - 24, { align: "center" });
  }
  const file = scan.scan_type + "-" + scan.id.slice(0, 12);
  doc.save(`EmailDetection-${file}-report.pdf`);
}
