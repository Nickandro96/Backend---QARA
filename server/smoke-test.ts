/**
 * Smoke Test Automatique
 * 
 * Vérifie que toutes les routes et endpoints critiques fonctionnent.
 * Peut être exécuté :
 * - Manuellement : `pnpm smoke-test`
 * - Au démarrage du serveur (CI/CD)
 * - Avant un déploiement
 */

import http from 'http';

interface TestResult {
  name: string;
  passed: boolean;
  status?: number;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
const BASE_URL = 'http://localhost:3000';

/**
 * Teste une route HTTP GET
 */
async function testRoute(path: string, expectedStatuses: number[] = [200, 401, 302]): Promise<TestResult> {
  const startTime = Date.now();
  const name = `Route ${path}`;

  return new Promise((resolve) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      const duration = Date.now() - startTime;
      const passed = expectedStatuses.includes(res.statusCode || 0);

      resolve({
        name,
        passed,
        status: res.statusCode,
        duration,
      });

      // Consommer la réponse pour libérer la connexion
      res.resume();
    }).on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        name,
        passed: false,
        error: error.message,
        duration,
      });
    });
  });
}

/**
 * Teste un endpoint tRPC
 */
async function testEndpoint(path: string, expectedStatuses: number[] = [200, 401]): Promise<TestResult> {
  const startTime = Date.now();
  const name = `Endpoint ${path}`;

  return new Promise((resolve) => {
    http.get(`${BASE_URL}/api/trpc/${path}?input=%7B%7D`, (res) => {
      const duration = Date.now() - startTime;
      
      // 404 = endpoint manquant = FAIL
      const passed = res.statusCode !== 404 && expectedStatuses.includes(res.statusCode || 0);

      resolve({
        name,
        passed,
        status: res.statusCode,
        duration,
      });

      res.resume();
    }).on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        name,
        passed: false,
        error: error.message,
        duration,
      });
    });
  });
}

/**
 * Exécute tous les tests
 */
async function runSmokeTests() {
  console.log('🔥 Smoke Test - Démarrage\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Tests des routes principales
  console.log('📍 Test des Routes Principales...');
  results.push(await testRoute('/'));
  results.push(await testRoute('/audit'));
  results.push(await testRoute('/audits'));
  results.push(await testRoute('/reports'));
  results.push(await testRoute('/dashboard', [200, 302, 401])); // Peut rediriger vers login
  results.push(await testRoute('/fda/qualification'));
  results.push(await testRoute('/fda/audit'));
  results.push(await testRoute('/classification'));
  results.push(await testRoute('/documents'));

  // Tests des endpoints tRPC critiques
  console.log('\n🔌 Test des Endpoints tRPC...');
  results.push(await testEndpoint('audit.listAudits'));
  results.push(await testEndpoint('audit.getRecentAudits'));
  results.push(await testEndpoint('findings.list'));
  results.push(await testEndpoint('actions.list'));
  results.push(await testEndpoint('fda.getQuestions'));
  results.push(await testEndpoint('fda.getFrameworks'));

  // Affichage des résultats
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSULTATS SMOKE TEST');
  console.log('='.repeat(80));

  let passedCount = 0;
  let failedCount = 0;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    const statusInfo = result.status ? `[${result.status}]` : '';
    const errorInfo = result.error ? `(${result.error})` : '';
    const durationInfo = `${result.duration}ms`;

    console.log(`${icon} ${result.name.padEnd(40)} ${statusInfo.padEnd(6)} ${durationInfo.padStart(8)} ${errorInfo}`);

    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  console.log('='.repeat(80));
  console.log(`✅ Réussis : ${passedCount}/${results.length}`);
  console.log(`❌ Échoués : ${failedCount}/${results.length}`);
  console.log('='.repeat(80));

  // Retourner le code de sortie
  if (failedCount > 0) {
    console.log('\n❌ SMOKE TEST ÉCHOUÉ\n');
    process.exit(1);
  } else {
    console.log('\n✅ SMOKE TEST RÉUSSI\n');
    process.exit(0);
  }
}

// Attendre que le serveur soit prêt
console.log('⏳ Attente du serveur...');
setTimeout(() => {
  runSmokeTests().catch((error) => {
    console.error(`\n💥 Erreur fatale : ${error.message}\n`);
    process.exit(1);
  });
}, 3000); // Attendre 3 secondes
