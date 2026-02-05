import puppeteer from "puppeteer";

interface PackDGData {
  globalScore: number;
  conformityRate: number;
  ncMajor: number;
  ncMinor: number;
  observations: number;
  ofi: number;
  actionsOverdue: number;
  closureRate: number;
  avgClosureDelay: number;
  topRisks: Array<{ clause: string; count: number; description: string }>;
  topActions: Array<{ code: string; title: string; dueDate: string; priority: string }>;
  insights: string[];
  generatedAt: Date;
  period: string;
}

/**
 * Generate Pack DG PDF report
 * One-page executive summary with KPIs, risks, and priority actions
 */
export async function generatePackDGPDF(data: PackDGData): Promise<Buffer> {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pack Direction Générale - Conformité Réglementaire</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #1f2937;
      padding: 20mm;
      background: white;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 3px solid #2563eb;
    }
    
    .header h1 {
      font-size: 24pt;
      color: #1e40af;
      margin-bottom: 5px;
    }
    
    .header .subtitle {
      font-size: 12pt;
      color: #6b7280;
    }
    
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 10px;
      background: #f3f4f6;
      border-radius: 4px;
    }
    
    .meta-item {
      font-size: 10pt;
    }
    
    .meta-item strong {
      color: #374151;
    }
    
    .section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 14pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #dbeafe;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .kpi-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    
    .kpi-label {
      font-size: 9pt;
      color: #6b7280;
      margin-bottom: 5px;
    }
    
    .kpi-value {
      font-size: 20pt;
      font-weight: bold;
      color: #1e40af;
    }
    
    .kpi-value.warning {
      color: #dc2626;
    }
    
    .kpi-value.success {
      color: #16a34a;
    }
    
    .risk-table, .action-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 9pt;
    }
    
    .risk-table th, .action-table th {
      background: #1e40af;
      color: white;
      padding: 8px;
      text-align: left;
      font-weight: bold;
    }
    
    .risk-table td, .action-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .risk-table tr:hover, .action-table tr:hover {
      background: #f9fafb;
    }
    
    .priority-critical {
      background: #fee2e2;
      color: #991b1b;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 8pt;
    }
    
    .priority-high {
      background: #fef3c7;
      color: #92400e;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 8pt;
    }
    
    .insights {
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 12px;
      margin-bottom: 15px;
    }
    
    .insights-list {
      list-style: none;
      padding-left: 0;
    }
    
    .insights-list li {
      padding: 4px 0;
      font-size: 10pt;
    }
    
    .insights-list li:before {
      content: "→ ";
      color: #2563eb;
      font-weight: bold;
      margin-right: 5px;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #6b7280;
    }
    
    .status-indicator {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 5px;
    }
    
    .status-ok {
      background: #16a34a;
    }
    
    .status-warning {
      background: #eab308;
    }
    
    .status-critical {
      background: #dc2626;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Pack Direction Générale</h1>
    <div class="subtitle">Synthèse Conformité Réglementaire & Qualité</div>
  </div>
  
  <div class="meta">
    <div class="meta-item"><strong>Période:</strong> ${data.period}</div>
    <div class="meta-item"><strong>Généré le:</strong> ${new Date(data.generatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</div>
    <div class="meta-item">
      <span class="status-indicator ${data.globalScore >= 90 ? "status-ok" : data.globalScore >= 75 ? "status-warning" : "status-critical"}"></span>
      <strong>Statut:</strong> ${data.globalScore >= 90 ? "Conforme" : data.globalScore >= 75 ? "Attention" : "Critique"}
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">📈 Indicateurs Clés de Performance</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Score Global</div>
        <div class="kpi-value ${data.globalScore >= 85 ? "success" : data.globalScore >= 70 ? "" : "warning"}">${data.globalScore.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux de Conformité</div>
        <div class="kpi-value success">${data.conformityRate.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">NC Majeures</div>
        <div class="kpi-value ${data.ncMajor > 5 ? "warning" : ""}">${data.ncMajor}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">NC Mineures</div>
        <div class="kpi-value">${data.ncMinor}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Observations</div>
        <div class="kpi-value">${data.observations}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">OFI</div>
        <div class="kpi-value">${data.ofi}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux Clôture Actions</div>
        <div class="kpi-value ${data.closureRate >= 80 ? "success" : "warning"}">${data.closureRate.toFixed(0)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Actions en Retard</div>
        <div class="kpi-value ${data.actionsOverdue > 0 ? "warning" : "success"}">${data.actionsOverdue}</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">⚠️ Top Risques Identifiés</div>
    <table class="risk-table">
      <thead>
        <tr>
          <th style="width: 15%">Clause</th>
          <th style="width: 10%">Occurrences</th>
          <th style="width: 75%">Description</th>
        </tr>
      </thead>
      <tbody>
        ${data.topRisks.slice(0, 5).map(risk => `
          <tr>
            <td><strong>${risk.clause}</strong></td>
            <td style="text-align: center;">${risk.count}</td>
            <td>${risk.description}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">🎯 Actions Prioritaires</div>
    <table class="action-table">
      <thead>
        <tr>
          <th style="width: 15%">Code</th>
          <th style="width: 55%">Action</th>
          <th style="width: 15%">Échéance</th>
          <th style="width: 15%">Priorité</th>
        </tr>
      </thead>
      <tbody>
        ${data.topActions.slice(0, 5).map(action => `
          <tr>
            <td><strong>${action.code}</strong></td>
            <td>${action.title}</td>
            <td>${new Date(action.dueDate).toLocaleDateString("fr-FR")}</td>
            <td><span class="priority-${action.priority.toLowerCase()}">${action.priority.toUpperCase()}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">💡 Insights Automatiques</div>
    <div class="insights">
      <ul class="insights-list">
        ${data.insights.map(insight => `<li>${insight}</li>`).join("")}
      </ul>
    </div>
  </div>
  
  <div class="footer">
    <p>Document confidentiel - Réservé à la Direction Générale</p>
    <p>MDR Compliance Platform - © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>
  `;

  // Launch headless browser and generate PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
