import type { Config } from 'drizzle-kit';

export default {
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    driver: 'mysql2',
    connectionString: process.env.DATABASE_URL as string,
  },
} satisfies Config;
