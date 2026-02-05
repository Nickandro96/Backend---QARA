#!/usr/bin/env tsx
/**
 * Script consolidé pour exécuter tous les tests
 * Usage: pnpm test:all
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  passed: number;
  failed: number;
  total: number;
  duration: string;
  status: 'success' | 'failure' | 'error';
}

const results: TestResult[] = [];

function runCommand(command: string, name: string): TestResult {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Exécution: ${name}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();
  
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
    
    return {
      name,
      passed: 0, // À parser depuis l'output
      failed: 0,
      total: 0,
      duration,
      status: 'success',
    };
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
    
    // Certains tests peuvent échouer mais retourner un code d'erreur
    // On considère cela comme un succès partiel
    return {
      name,
      passed: 0,
      failed: 0,
      total: 0,
      duration,
      status: 'failure',
    };
  }
}

function generateReport() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RAPPORT CONSOLIDÉ DES TESTS`);
  console.log(`${'='.repeat(60)}\n`);

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);

  results.forEach((result) => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   Durée: ${result.duration}`);
    console.log(`   Statut: ${result.status.toUpperCase()}`);
    console.log();
  });

  console.log(`${'='.repeat(60)}`);
  console.log(`📈 RÉSUMÉ GLOBAL`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passés: ${totalPassed}`);
  console.log(`Échoués: ${totalFailed}`);
  
  if (totalTests > 0) {
    const successRate = ((totalPassed / totalTests) * 100).toFixed(1);
    console.log(`Taux de réussite: ${successRate}%`);
  }
  
  console.log(`${'='.repeat(60)}\n`);

  // Sauvegarder le rapport dans un fichier
  const reportPath = path.join(process.cwd(), 'test-results-all.json');
  fs.writeFileSync(reportPath, JSON.stringify({ results, summary: { totalPassed, totalFailed, totalTests } }, null, 2));
  console.log(`📝 Rapport sauvegardé: ${reportPath}\n`);

  // Retourner code d'erreur si des tests ont échoué
  const hasFailures = results.some(r => r.status === 'failure' || r.status === 'error');
  process.exit(hasFailures ? 1 : 0);
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧪 SUITE DE TESTS CONSOLIDÉE - MDR Compliance Platform  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // 1. Smoke Test
  const smokeResult = runCommand('pnpm smoke-test', 'Smoke Test (Routes & Endpoints)');
  results.push(smokeResult);

  // 2. Tests Unitaires (Vitest)
  const vitestResult = runCommand('pnpm test', 'Tests Unitaires (Vitest)');
  results.push(vitestResult);

  // 3. Tests E2E (Playwright)
  const e2eResult = runCommand('pnpm test:e2e', 'Tests E2E (Playwright)');
  results.push(e2eResult);

  // Générer le rapport final
  generateReport();
}

main().catch((error) => {
  console.error('❌ Erreur lors de l\'exécution des tests:', error);
  process.exit(1);
});
