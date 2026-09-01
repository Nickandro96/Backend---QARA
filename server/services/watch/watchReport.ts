import PDFDocument from "pdfkit";
import type { RegulatoryUpdate } from "./types";

function classification(item: RegulatoryUpdate): "action_required" | "watch" | "informational" {
  return (item.analysisCriticality
    ?? (item.impactLevel === "Critical" ? "action_required" : item.impactLevel === "High" ? "watch" : "informational"));
}

export function orderWatchReportItems(items: RegulatoryUpdate[]): RegulatoryUpdate[] {
  const rank = { action_required: 0, watch: 1, informational: 2 };
  return [...items].sort((a, b) => rank[classification(a)] - rank[classification(b)]);
}

export async function renderWatchReportPdf(input: { organisation: string; period: string; items: RegulatoryUpdate[]; sources: Array<{ name: string; active?: boolean; lastError?: string | null }>; watchCapaIds: Set<string> }): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.fontSize(22).text("Rapport de surveillance réglementaire");
  doc.moveDown().fontSize(11).text(`Organisation : ${input.organisation}`).text(`Période : ${input.period}`).text(`Généré le : ${new Date().toISOString().slice(0, 10)}`);
  doc.addPage().fontSize(18).text("Tableau de bord");
  const colors = { action_required: "#dc2626", watch: "#d97706", informational: "#2563eb" };
  const maxCount = Math.max(1, ...(["action_required", "watch", "informational"] as const).map((level) => input.items.filter((i) => classification(i) === level).length));
  for (const level of ["action_required", "watch", "informational"] as const) {
    const count = input.items.filter((i) => classification(i) === level).length;
    doc.fontSize(11).fillColor("#111827").text(`${level} : ${count}`);
    const y = doc.y + 2; doc.rect(48, y, 360, 10).fill("#e5e7eb"); doc.rect(48, y, 360 * count / maxCount, 10).fill(colors[level]); doc.moveDown(1.2);
  }
  doc.moveDown().text(`Sources actives : ${input.sources.filter((source) => source.active !== false).length}`).text(`Sources en erreur : ${input.sources.filter((source) => Boolean(source.lastError)).length}`).text(`Taux d'analyse IA : ${input.items.length ? Math.round(input.items.filter((item) => item.aiAnalyzed).length / input.items.length * 100) : 0}%`);
  let current = "";
  for (const item of orderWatchReportItems(input.items)) {
    const level = classification(item);
    if (level !== current) { doc.addPage().fontSize(16).text(level === "action_required" ? "ACTION REQUISE" : level === "watch" ? "À SURVEILLER" : "INFORMATIF"); current = level; }
    doc.moveDown().fontSize(12).text(item.title).fontSize(9).text(`${item.sourceName} · ${item.officialId ?? "sans identifiant"} · ${item.publishedAt?.toISOString().slice(0, 10) ?? "date inconnue"}`);
    if (level !== "informational") doc.fontSize(10).text(item.summaryFr || item.summaryLong || item.summaryShort);
    if (item.keyChanges?.length) doc.fontSize(9).text(`Changements clés : ${item.keyChanges.join(" • ")}`);
    if (level === "action_required") doc.fontSize(10).text(`Action requise : ${item.actionRequired ?? "À définir"}`).text(`Échéance : ${item.dueDate?.toISOString().slice(0, 10) ?? "Non renseignée"}`).text(`Statut : ${input.watchCapaIds.has(item.id) ? "Action CAPA créée" : "En attente d'action"}`);
  }
  doc.addPage().fontSize(16).text("Déclaration de surveillance").moveDown().fontSize(11).text(`Ce rapport atteste de la surveillance réglementaire active de ${input.organisation} pour la période ${input.period}, conformément aux exigences de ISO 13485 §4.1 et MDR Art. 10(9).`);
  doc.moveDown().fontSize(12).text("Sources surveillées");
  for (const source of input.sources) doc.fontSize(9).text(`${source.name} — ${source.lastError ? "Erreur" : source.active === false ? "Inactive" : "Active"}`);
  doc.end();
  return done;
}
