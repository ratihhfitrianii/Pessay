import 'dotenv/config';
import { createApp } from './app';
import { pingDatabase } from './lib/pg';
import { createGradingAdapter } from './grading/gemini';
import { BatchGrader } from './grading/batch';

async function main(): Promise<void> {
  await pingDatabase();

  const app = createApp();
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[pessay] backend siap di http://localhost:${port}`);
  });

  // Batch grader — hanya di proses server, tidak saat test.
  if (process.env.NODE_ENV !== 'test') {
    const adapter = createGradingAdapter(
      process.env.GRADING_MODE ?? 'mock',
      process.env.GEMINI_API_KEY ?? '',
      process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    );
    const grader = new BatchGrader(
      adapter,
      Number(process.env.GRADING_BATCH_SIZE ?? 10),
      Number(process.env.GRADING_INTERVAL_MS ?? 10000),
      Number(process.env.GRADING_MAX_CONCURRENCY ?? 3),
    );
    grader.start();
    // eslint-disable-next-line no-console
    console.log(`[pessay] batch grader berjalan (mode=${adapter.mode}, batch=${grader['batchSize']})`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[pessay] gagal startup:', err);
  process.exit(1);
});