/**
 * FDA Questions Batch Import (TypeScript + Drizzle)
 * Reads fda-questions-insert.sql and executes via Drizzle raw queries
 */

import { readFileSync } from 'fs';
import { getDb } from './db';

async function main() {
  console.log('🚀 FDA Questions Batch Import');
  console.log('='.repeat(60));
  
  const db = await getDb();
  const sqlFile = '/home/ubuntu/mdr-compliance-platform/fda-questions-insert.sql';
  
  console.log(`📄 Reading SQL file: ${sqlFile}`);
  const sqlContent = readFileSync(sqlFile, 'utf-8');
  
  // Split by semicolon to get individual statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`📊 Found ${statements.length} SQL statements`);
  console.log(`⏳ Executing in batches of 50...\n`);
  
  let executed = 0;
  let errors = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    
    try {
      await db.execute(stmt);
      executed++;
      
      if ((i + 1) % 50 === 0) {
        console.log(`✅ Executed ${i + 1}/${statements.length} statements`);
      }
    } catch (error: any) {
      errors++;
      console.error(`❌ Error at statement ${i + 1}: ${error.message}`);
      // Continue on error (some statements might be duplicates)
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Import completed!`);
  console.log(`   Executed: ${executed}/${statements.length}`);
  console.log(`   Errors: ${errors}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
