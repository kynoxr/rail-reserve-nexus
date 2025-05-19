
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || "postgres://user:pass@localhost:5432/railway"; // Replace at runtime

export const pool = new Pool({
  connectionString,
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}
