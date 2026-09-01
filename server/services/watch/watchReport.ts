import PDFDocument from "pdfkit";
import type { RegulatoryUpdate } from "./types";

function classification(item: RegulatoryUpdate): "action_required" | "watch" | "informational" {
  return ((item as RegulatoryUpdate & { criticality?: "action_required" | "watch" | "informational" }).criticality
    ?? (item.impactLevel === "Critical" ? "action_required" : item.impactLevel === "High" ? "watch" : "informational"));
}

export function orderWatchReportItems(items: RegulatoryUpdate[]): RegulatoryUpdate[] {
  const rank = { action_required: 0, watch: 1, informational: 2 };
  return [...items].sort((a, b) => rank[classification(a)] - rank[classification(b)]);
}

export async function renderWatchReportPdf(input: { organisation: string; period: string; items: RegulatoryUpdate[] }): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.fontSize(22).text("Rapport de surveillance réglementaire");
  doc.moveDown().fontSize(11).text(`Organisation : ${input.organisation}`).text(`Période : ${input.period}`).text(`Généré le : ${new Date().toISOString().slice(0, 10)}`);
  doc.addPage().fontSize(18).text("Tableau de bord");
  for (const level of ["action_required", "watch", "informational"] as const) doc.fontSize(11).text(`${level} : ${input.items.filter((i) => classification(i) === level).length}`);
  let current = "";
  for (const item of orderWatchReportItems(input.items)) {
    const level = classification(item);
    if (level !== current) { doc.addPage().fontSize(16).text(level === "action_required" ? "ACTION REQUISE" : level === "watch" ? "À SURVEILLER" : "INFORMATIF"); current = level; }
    doc.moveDown().fontSize(12).text(item.title).fontSize(9).text(`${item.sourceName} · ${item.officialId ?? "sans identifiant"} · ${item.publishedAt?.toISOString().slice(0, 10) ?? "date inconnue"}`);
    if (level !== "informational") doc.fontSize(10).text(item.summaryFr || item.summaryLong || item.summaryShort);
  }
  doc.addPage().fontSize(16).text("Déclaration de surveillance").moveDown().fontSize(11).text(`Ce rapport atteste de la surveillance réglementaire active de ${input.organisation} pour la période ${input.period}, conformément aux exigences de ISO 13485 §4.1 et MDR Art. 10(9).`);
  doc.end();
  return done;
}
