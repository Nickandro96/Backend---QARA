
import { getDb } from "../db";
import { referentials, processes, mdrQuestions, isoQuestions, fdaQuestions } from "../../drizzle/schema";

async function check() {
  const db = await getDb();
  if (!db) {
    console.error("❌ Database connection failed");
    return;
  }

  const refs = await db.select().from(referentials);
  const procs = await db.select().from(processes);
  const mdrQ = await db.select().from(mdrQuestions).limit(5);
  const isoQ = await db.select().from(isoQuestions).limit(5);
  const fdaQ = await db.select().from(fdaQuestions).limit(5);

  console.log("📊 Database Content Check:");
  console.log(`- Referentials: ${refs.length}`);
  refs.forEach(r => console.log(`  • [${r.code}] ${r.name}`));
  
  console.log(`- Processes: ${procs.length}`);
  procs.forEach(p => console.log(`  • ${p.name}`));

  console.log(`- MDR Questions: ${mdrQ.length} (sample)`);
  console.log(`- ISO Questions: ${isoQ.length} (sample)`);
  console.log(`- FDA Questions: ${fdaQ.length} (sample)`);
}

check().catch(console.error);
