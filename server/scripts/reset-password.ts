
import mysql from "mysql2/promise";
import crypto from "crypto";
import "dotenv/config";

// Re-implement hashPassword locally to avoid import issues
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

async function resetPassword() {
  const email = "nickandroklauss@gmail.com";
  const newPassword = "Admin2026!";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    return;
  }

  try {
    const connection = await mysql.createConnection(connectionString);
    console.log(`✅ Connected to MySQL. Resetting password for ${email}...`);

    // 1. Get user by email
    const [users]: any = await connection.execute(
      "SELECT id, openId FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      console.error(`❌ User ${email} not found in database.`);
      return;
    }

    const user = users[0];
    const hashedPassword = hashPassword(newPassword);

    // 2. Update password hash in auth_passwords table
    await connection.execute(
      "INSERT INTO auth_passwords (userId, passwordHash) VALUES (?, ?) ON DUPLICATE KEY UPDATE passwordHash = ?",
      [user.openId, hashedPassword, hashedPassword]
    );

    // 3. Ensure user has admin role
    await connection.execute(
      "UPDATE users SET role = 'admin' WHERE id = ?",
      [user.id]
    );

    console.log(`✨ Success! Password for ${email} has been reset to: ${newPassword}`);
    console.log(`👑 User role has been set to 'admin'.`);

    await connection.end();
  } catch (error) {
    console.error("❌ Reset failed:", error);
  }
}

resetPassword();
