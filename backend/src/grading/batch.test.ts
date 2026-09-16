import { BatchGrader } from './batch';
import { MockGradingAdapter } from './mock';
import { pool } from '../lib/pg';
import {
  cleanupTestData,
  createAssignment,
  createClass,
  createPrompt,
  createSubmission,
  createUser,
  enroll,
  runToken,
} from '../test/fixtures';

const adapter = new MockGradingAdapter();

describe('BatchGrader', () => {
  let guruId: number;
  let siswaId: number;
  let siswa2Id: number;
  let classId: number;
  let promptId: number;
  let assignmentId: number;

  beforeAll(async () => {
    // Bersihkan semua submission pending dari suite lain agar tick() hanya
    // memproses milik test ini.
    await pool.query(`DELETE FROM submissions WHERE status = 'pending'`);
    const guru = await createUser('guru');
    const siswa = await createUser('siswa');
    const siswa2 = await createUser('siswa');
    guruId = guru.id;
    siswaId = siswa.id;
    siswa2Id = siswa2.id;
    classId = await createClass(`CLS-BATCH-${runToken()}`, guruId);
    await enroll(classId, siswaId);
    await enroll(classId, siswa2Id);
    promptId = await createPrompt({ subject: 'bahasa' });
    assignmentId = await createAssignment(promptId, classId, `Ujian-BATCH-${runToken()}`);
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [guruId, siswaId, siswa2Id]);
  });

  it('tick memproses semua submission pending', async () => {
    const s1 = await createSubmission(
      assignmentId,
      siswaId,
      'Pendidikan yang bermutu adalah hak setiap warga negara dan menjadi kunci kemajuan bangsa Indonesia di masa depan.',
      'pending',
    );
    const s2 = await createSubmission(
      assignmentId,
      siswa2Id,
      'Kedisiplinan adalah kebiasaan kecil yang dilakukan setiap hari dan menghasilkan pencapaian besar dalam hidup.',
      'pending',
    );

    const grader = new BatchGrader(adapter, 10, 1000, 4);
    const r = await grader.tick();
    expect(r.processed).toBe(2);
    expect(r.failed).toBe(0);

    const { rows } = await pool.query(
      `SELECT status FROM submissions WHERE id IN ($1, $2)`,
      [s1, s2],
    );
    for (const row of rows) {
      expect(['graded', 'needs_review']).toContain(row.status);
    }
    grader.stop();
  });

  it('tick saat sudah running → langsung {0,0}', async () => {
    const grader = new BatchGrader(adapter, 10, 1000, 4);
    const p1 = grader.tick();
    const p2 = await grader.tick();
    expect(p2).toEqual({ processed: 0, failed: 0 });
    await p1;
    grader.stop();
  });

  it('tick tanpa pending → {0,0}', async () => {
    await pool.query(`DELETE FROM submissions WHERE status = 'pending'`);
    const grader = new BatchGrader(adapter, 10, 1000, 4);
    const r = await grader.tick();
    expect(r).toEqual({ processed: 0, failed: 0 });
    grader.stop();
  });

  it('adapter gagal → dihitung failed, tidak menggagalkan batch', async () => {
    const failing = {
      mode: 'mock',
      grade: async () => {
        throw new Error('AI provider down');
      },
    };
    const p2 = await createPrompt({ subject: 'bahasa' });
    const a2 = await createAssignment(p2, classId, `Ujian-BATCH-FAIL-${runToken()}`);
    const s1 = await createSubmission(
      a2,
      siswaId,
      'Teks uji untuk kegagalan adapter yang cukup panjang agar lolos filter unscorable dan masuk ke grade.',
      'pending',
    );
    const s2 = await createSubmission(
      a2,
      siswa2Id,
      'Teks uji kedua untuk kegagalan adapter yang cukup panjang agar lolos filter unscorable dan masuk ke grade.',
      'pending',
    );

    const grader = new BatchGrader(failing as never, 10, 1000, 2);
    const r = await grader.tick();
    expect(r.processed).toBe(0);
    expect(r.failed).toBe(2);

    const { rows } = await pool.query(
      `SELECT status FROM submissions WHERE id IN ($1, $2)`,
      [s1, s2],
    );
    for (const row of rows) {
      expect(row.status).toBe('pending'); // rollback → tetap antre
    }
    grader.stop();
  });

  it('start() memulai interval, stop() membersihkannya', () => {
    const grader = new BatchGrader(adapter, 10, 1000, 2);
    grader.start();
    expect((grader as unknown as { timer: ReturnType<typeof setInterval> | null }).timer).not.toBeNull();
    grader.start(); // idempotent
    grader.stop();
    expect((grader as unknown as { timer: ReturnType<typeof setInterval> | null }).timer).toBeNull();
    grader.stop(); // idempotent
  });
});