import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

export async function initializeDatabase() {
  try {
    console.log("Initializing database...");
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "railway",
    });
    
    // Read and execute all migration files
    const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort();
      
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
        
        for (const statement of statements) {
          try {
            await connection.execute(statement);
          } catch (err: any) {
            if (err.code !== "ER_TABLE_EXISTS_ERROR" && err.code !== "ER_DUP_KEYNAME") {
              console.warn(`Warning executing ${file}:`, err.message);
            }
          }
        }
      }
    }
    
    await connection.end();
    console.log("Database initialized successfully");
  } catch (error) {
    console.warn("Database initialization warning:", error);
    // Don't fail startup if initialization fails - database might already be initialized
  }
}
