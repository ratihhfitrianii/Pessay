import { pool } from "../lib/pg";
import type { GradingAdapter } from "./types";
import { processSubmission } from "./pipeline";

/**
 * Batch grader — konsumen antrean DB.
 *
 * Setiap tick: ambil batch submission 'pending' (FOR UPDATE SKIP LOCKED agar
 * aman terhadap banyak worker), proses paralel dengan concurrency terbatas,
 * lalu berhenti. Menangani 2.000+ kiriman serentak tanpa broker eksternal:
 * API menerima instan (status pending), worker menggiling bertahap.
 */
export class BatchGrader {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly adapter: GradingAdapter,
    private readonly batchSize: number,
    private readonly intervalMs: number,
    private readonly maxConcurrency: number,
  ) {}

  async tick(): Promise<{ processed: number; failed: number }> {
    if (this.running) return { processed: 0, failed: 0 };
    this.running = true;
    try {
      const { rows } = await pool.query(
        `SELECT id FROM submissions
         WHERE status = 'pending'
         ORDER BY id
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [this.batchSize],
      );
      const ids = (rows as { id: string }[]).map((r) => Number(r.id));
      if (ids.length === 0) return { processed: 0, failed: 0 };

      let processed = 0;
      let failed = 0;
      const queue = [...ids];
      const workers = Array.from(
        { length: Math.min(this.maxConcurrency, queue.length) },
        async () => {
          while (queue.length > 0) {
            const id = queue.shift();
            if (id === undefined) break;
            try {
              await processSubmission(id, this.adapter);
              processed++;
            } catch {
              failed++;
            }
          }
        },
      );
      await Promise.all(workers);
      return { processed, failed };
    } finally {
      this.running = false;
    }
  }

  start(): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[grader] tick gagal:", err.message);
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
