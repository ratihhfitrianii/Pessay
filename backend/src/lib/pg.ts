import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX ?? 20),
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  // Jangan crash-loop saat Neon/Postgres idle-close koneksi; pool auto-reconnect.
  // eslint-disable-next-line no-console
  console.warn(
    "[pg] koneksi idle ditutup, pool akan membuat koneksi baru:",
    err.message,
  );
});

/** SELECT pertama saat startup — retry untuk cold-start Neon (auto-suspend). */
export async function pingDatabase(retries = 3, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[pg] startup SELECT 1 gagal (${i}/${retries}) — mungkin cold start, mencoba lagi...`,
      );
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
