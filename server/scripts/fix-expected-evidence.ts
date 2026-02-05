import { getDb } from "../db.js";
import { questions } from "../../drizzle/schema.js";
import { sql } from "drizzle-orm";

async function fixExpectedEvidence() {
  console.log("🚀 Starting expectedEvidence format fix...");
  
  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed!");
    return;
  }
  
  // Get all questions with non-JSON expectedEvidence
  const allQuestions = await db.select().from(questions);
  
  let fixedCount = 0;
  let alreadyJsonCount = 0;
  let nullCount = 0;
  
  for (const q of allQuestions) {
    if (!q.expectedEvidence) {
      nullCount++;
      continue;
    }
    
    // Try to parse as JSON
    try {
      JSON.parse(q.expectedEvidence);
      alreadyJsonCount++;
      continue; // Already valid JSON
    } catch (e) {
      // Not valid JSON, need to fix
      console.log(`Fixing question ${q.id}: ${q.expectedEvidence.substring(0, 50)}...`);
      
      // Convert text to JSON array
      // Split by common separators: comma, semicolon, newline
      const items = q.expectedEvidence
        .split(/[,;\n]/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      const jsonEvidence = JSON.stringify(items);
      
      // Update the question
      await db
        .update(questions)
        .set({ expectedEvidence: jsonEvidence })
        .where(sql`${questions.id} = ${q.id}`);
      
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Migration completed!`);
  console.log(`📊 Statistics:`);
  console.log(`   - Fixed: ${fixedCount} questions`);
  console.log(`   - Already JSON: ${alreadyJsonCount} questions`);
  console.log(`   - Null/Empty: ${nullCount} questions`);
  console.log(`   - Total: ${allQuestions.length} questions`);
}

fixExpectedEvidence().catch(console.error);
