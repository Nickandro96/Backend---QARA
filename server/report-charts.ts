/**
 * Chart Generation Module using QuickChart API
 * Generates charts for audit reports without native dependencies
 * 
 * QuickChart API: https://quickchart.io/
 * - Free and open-source
 * - No native dependencies (no canvas compilation)
 * - Compatible with Chart.js syntax
 * - Returns PNG images directly
 */

import type { AuditData, ReportMetadata } from "./report-generator";

const QUICKCHART_API_URL = "https://quickchart.io/chart";

/**
 * Generate a chart using QuickChart API
 */
async function generateChart(chartConfig: any): Promise<Buffer> {
  try {
    const response = await fetch(QUICKCHART_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chart: chartConfig,
        width: 600,
        height: 400,
        backgroundColor: "white",
        devicePixelRatio: 2.0, // High resolution
      }),
    });

    if (!response.ok) {
      throw new Error(`QuickChart API error: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error("[Charts] Error generating chart:", error.message);
    throw error;
  }
}

/**
 * 1. RADAR CHART - Conformity by Process
 * Shows compliance level for each process area
 */
export async function generateRadarChart(
  data: AuditData,
  metadata: ReportMetadata
): Promise<Buffer> {
  // Group findings by process
  const processCounts: Record<string, { total: number; compliant: number }> = {};

  data.findings.forEach((finding) => {
    const process = finding.process || "Autre";
    if (!processCounts[process]) {
      processCounts[process] = { total: 0, compliant: 0 };
    }
    processCounts[process].total++;
    if (finding.status === "Conforme") {
      processCounts[process].compliant++;
    }
  });

  // Calculate conformity percentage for each process
  const processes = Object.keys(processCounts);
  const conformityScores = processes.map((process) => {
    const { total, compliant } = processCounts[process];
    return total > 0 ? Math.round((compliant / total) * 100) : 0;
  });

  const chartConfig = {
    type: "radar",
    data: {
      labels: processes,
      datasets: [
        {
          label: "Taux de Conformité (%)",
          data: conformityScores,
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(54, 162, 235, 1)",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "rgba(54, 162, 235, 1)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Conformité par Processus",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
        },
      },
    },
  };

  return generateChart(chartConfig);
}

/**
 * 2. HISTOGRAM - Non-Conformities by Criticality
 * Bar chart showing distribution of findings by severity
 */
export async function generateHistogramChart(
  data: AuditData,
  metadata: ReportMetadata
): Promise<Buffer> {
  // Count findings by criticality
  const criticalityCounts = {
    Critique: 0,
    Majeure: 0,
    Mineure: 0,
    Observation: 0,
  };

  data.findings.forEach((finding) => {
    const criticality = finding.criticality || "Observation";
    if (criticality in criticalityCounts) {
      criticalityCounts[criticality as keyof typeof criticalityCounts]++;
    }
  });

  const chartConfig = {
    type: "bar",
    data: {
      labels: ["Critique", "Majeure", "Mineure", "Observation"],
      datasets: [
        {
          label: "Nombre de Constats",
          data: [
            criticalityCounts.Critique,
            criticalityCounts.Majeure,
            criticalityCounts.Mineure,
            criticalityCounts.Observation,
          ],
          backgroundColor: [
            "rgba(220, 53, 69, 0.8)",  // Red for Critical
            "rgba(255, 193, 7, 0.8)",  // Orange for Major
            "rgba(255, 235, 59, 0.8)", // Yellow for Minor
            "rgba(33, 150, 243, 0.8)", // Blue for Observation
          ],
          borderColor: [
            "rgba(220, 53, 69, 1)",
            "rgba(255, 193, 7, 1)",
            "rgba(255, 235, 59, 1)",
            "rgba(33, 150, 243, 1)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Non-Conformités par Criticité",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: false,
        },
      },
    },
  };

  return generateChart(chartConfig);
}

/**
 * 3. HEATMAP - Risk Matrix (Criticality x Process)
 * Shows risk distribution across processes
 */
export async function generateHeatmapChart(
  data: AuditData,
  metadata: ReportMetadata
): Promise<Buffer> {
  // Create a matrix of processes vs criticality
  const processes = [...new Set(data.findings.map((f) => f.process || "Autre"))];
  const criticalities = ["Critique", "Majeure", "Mineure", "Observation"];

  // Count findings for each process-criticality combination
  const matrix: number[][] = criticalities.map((crit) =>
    processes.map((proc) => {
      return data.findings.filter(
        (f) =>
          (f.process || "Autre") === proc &&
          (f.criticality || "Observation") === crit
      ).length;
    })
  );

  // Create bar chart data (simplified heatmap representation)
  const datasets = criticalities.map((crit, index) => ({
    label: crit,
    data: matrix[index],
    backgroundColor: [
      "rgba(220, 53, 69, 0.8)",  // Red
      "rgba(255, 193, 7, 0.8)",  // Orange
      "rgba(255, 235, 59, 0.8)", // Yellow
      "rgba(33, 150, 243, 0.8)", // Blue
    ][index],
  }));

  const chartConfig = {
    type: "bar",
    data: {
      labels: processes,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Matrice de Risques (Processus x Criticité)",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
        },
      },
    },
  };

  return generateChart(chartConfig);
}

/**
 * 4. TIMELINE - 12-Month Evolution
 * Line chart showing trend of conformity over time
 */
export async function generateTimelineChart(
  data: AuditData,
  metadata: ReportMetadata
): Promise<Buffer> {
  // Generate mock data for 12 months (in real implementation, fetch from database)
  const months = [
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Jun",
    "Jul",
    "Aoû",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
  ];

  // Simulate conformity trend (in real implementation, calculate from historical audits)
  const currentConformity = metadata.conformityRate;
  const conformityData = months.map((_, index) => {
    // Simulate gradual improvement over time
    const variation = Math.random() * 10 - 5; // ±5%
    return Math.max(0, Math.min(100, currentConformity - (11 - index) * 2 + variation));
  });

  const chartConfig = {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "Taux de Conformité (%)",
          data: conformityData,
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "rgba(75, 192, 192, 1)",
          pointBorderColor: "#fff",
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            callback: "(value) => value + '%'",
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Évolution de la Conformité (12 mois)",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
        },
      },
    },
  };

  return generateChart(chartConfig);
}
