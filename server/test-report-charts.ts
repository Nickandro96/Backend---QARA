/**
 * Test script for report generation with charts integration
 * Tests the complete report generation flow including Chart.js charts
 */

import { generateAuditReport } from "./report-generator";
import { writeFileSync } from "fs";
import { join } from "path";

async function testReportGeneration() {
  console.log("🧪 Starting report generation test with charts...\n");

  try {
    // Test parameters
    const options = {
      auditId: 1,
      reportType: "complete" as const,
      includeGraphs: true,
      includeEvidence: true,
      includeActionPlan: true,
      language: "fr" as const,
    };

    console.log("📋 Test parameters:");
    console.log(`   - Audit ID: ${options.auditId}`);
    console.log(`   - Report Type: ${options.reportType}`);
    console.log(`   - Include Graphs: ${options.includeGraphs}`);
    console.log(`   - Include Evidence: ${options.includeEvidence}`);
    console.log(`   - Include Action Plan: ${options.includeActionPlan}`);
    console.log(`   - Language: ${options.language}\n`);

    console.log("⏳ Generating PDF report...");
    const startTime = Date.now();

    // Generate report
    const pdfBuffer = await generateAuditReport(options);

    const duration = Date.now() - startTime;
    console.log(`✅ Report generated successfully in ${duration}ms`);
    console.log(`📊 PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    // Save to file
    const outputPath = "/home/ubuntu/mdr-compliance-platform/test-report-with-charts.pdf";
    writeFileSync(outputPath, pdfBuffer);
    console.log(`💾 Report saved to: ${outputPath}`);

    console.log("\n✅ TEST PASSED - Report generation with charts successful!");
    console.log("\n📝 Next steps:");
    console.log("   1. Open test-report-with-charts.pdf to verify charts are embedded");
    console.log("   2. Check that all 4 charts are visible (radar, histogram, heatmap, timeline)");
    console.log("   3. Verify chart quality and positioning");

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ TEST FAILED - Error generating report:");
    console.error(error);
    console.error("\nStack trace:");
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testReportGeneration();
