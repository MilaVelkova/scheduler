import pg from "pg";

export const pool = process.env.DATABASE_URL
  ? new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true, 
  })
  : new pg.Pool({
    host: "127.0.0.1",
    port: 55432,
    user: "postgres",
    password: "postgres",
    database: "scheduler",
  });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS slots (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
      booked_by_name TEXT,
      booked_by_email TEXT,
      booked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (date, start_time)
    )
  `);
}