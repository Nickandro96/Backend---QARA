#!/usr/bin/env tsx
/**
 * Script de test pour vérifier les permissions admin
 * Usage: pnpm tsx server/test-admin-permissions.ts
 */

import * as db from './db';

async function testAdminPermissions() {
  console.log('\n🧪 Test Permissions Admin\n');
  console.log('='.repeat(60));

  // Test 1: getRecentAudits avec admin
  console.log('\n📋 Test 1: getRecentAudits (admin)');
  const recentAuditsAdmin = await db.getRecentAudits(1, 5, 'admin');
  console.log(`✅ Audits récents (admin): ${recentAuditsAdmin.length} audits`);
  if (recentAuditsAdmin.length > 0) {
    console.log(`   Premier audit: ${recentAuditsAdmin[0].name} (ID: ${recentAuditsAdmin[0].id})`);
  }

  // Test 2: getRecentAudits avec user
  console.log('\n📋 Test 2: getRecentAudits (user)');
  const recentAuditsUser = await db.getRecentAudits(1, 5, 'user');
  console.log(`✅ Audits récents (user): ${recentAuditsUser.length} audits`);

  // Test 3: getAuditsList avec admin
  console.log('\n📋 Test 3: getAuditsList (admin)');
  const auditsListAdmin = await db.getAuditsList(1, 'admin');
  console.log(`✅ Liste audits (admin): ${auditsListAdmin.length} audits`);

  // Test 4: getAuditsList avec user
  console.log('\n📋 Test 4: getAuditsList (user)');
  const auditsListUser = await db.getAuditsList(1, 'user');
  console.log(`✅ Liste audits (user): ${auditsListUser.length} audits`);

  // Test 5: getAuditById avec admin (audit d'un autre utilisateur)
  if (recentAuditsAdmin.length > 0) {
    const auditId = recentAuditsAdmin[0].id;
    console.log(`\n📋 Test 5: getAuditById (admin, audit ID ${auditId})`);
    const auditAdmin = await db.getAuditById(auditId, 999, 'admin'); // userId 999 ne possède pas cet audit
    if (auditAdmin) {
      console.log(`✅ Audit accessible (admin): ${auditAdmin.id}`);
    } else {
      console.log(`❌ Audit non accessible (admin)`);
    }

    console.log(`\n📋 Test 6: getAuditById (user, audit ID ${auditId})`);
    const auditUser = await db.getAuditById(auditId, 999, 'user'); // userId 999 ne possède pas cet audit
    if (auditUser) {
      console.log(`❌ Audit accessible (user) - ERREUR: ne devrait pas être accessible`);
    } else {
      console.log(`✅ Audit non accessible (user) - Correct`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Tests terminés\n');
}

testAdminPermissions().catch((error) => {
  console.error('❌ Erreur lors des tests:', error);
  process.exit(1);
});
