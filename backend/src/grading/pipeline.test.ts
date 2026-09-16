import { MockGradingAdapter } from './mock.js';
import { processSubmission } from './pipeline.js';
import { pool } from '../lib/pg.js';
import {
  cleanupTestData,
  createAssignment,
  createClass,
  createPrompt,
  createSubmission,
  createUser,
  enroll,
} from '../test/fixtures.js';

const adapter = new MockGradingAdapter();

describe('pipeline processSubmission', () => {
  let guruId: number;
  let siswaId: number;
  let classId: number;
  let promptId: number;
  let assignmentId: number;

  beforeAll(async () => {
    const guru = await createUser('guru');
    const siswa = await createUser('siswa');
    guruId = guru.id;
    siswaId = siswa.id;
    classId = await createClass(`CLS-PIPE-${Date.now().toString().slice(-6)}`, guruId);
    await enroll(classId, siswaId);
  }, 30000);

  afterAll(async () => {
    await pool.query(`DELETE FROM classes WHERE id = $1`, [classId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [guruId, siswaId]);
    await cleanupTestData();
  });

  it('submission pendek (unscorable) → status unscorable, tidak diproses AI', async () => {
    promptId = await createPrompt({ subject: 'bahasa' });
    assignmentId = await createAssignment(promptId, classId, `Ujian-PIPE1-${Date.now().toString().slice(-6)}`);
    const subId = await createSubmission(assignmentId, siswaId, 'ya', 'pending');

    const r = await processSubmission(subId, adapter);
    expect(r.status).toBe('unscorable');
    expect(r.score).toBeNull();

    const { rows } = await pool.query(`SELECT status, anomaly_json FROM submissions WHERE id = $1`, [subId]);
    expect(rows[0]!.status).toBe('unscorable');
    expect(JSON.parse(rows[0]!.anomaly_json)[0]).toHaveProperty('type', 'unscorable');
  });

  it('submission normal → graded dengan score > 0', async () => {
    promptId = await createPrompt({ subject: 'bahasa' });
    assignmentId = await createAssignment(promptId, classId, `Ujian-PIPE2-${Date.now().toString().slice(-6)}`);
    const subId = await createSubmission(
      assignmentId,
      siswaId,
      'Pendidikan adalah fondasi kemajuan bangsa dan setiap warga negara berhak memperoleh pendidikan yang bermutu serta terjangkau oleh semua lapisan masyarakat tanpa kecuali.',
      'pending',
    );

    const r = await processSubmission(subId, adapter);
    expect(r.status).toBe('graded');
    expect(r.score).toBeGreaterThan(0);

    const scores = await pool.query(`SELECT dimension FROM scores WHERE submission_id = $1`, [subId]);
    expect(scores.rows.length).toBeGreaterThan(0);
  });

  it('submission not found → 404 error', async () => {
    await expect(processSubmission(999999, adapter)).rejects.toThrow(/tidak ditemukan/);
  });

  it('submission status graded (bukan pending) → return status tanpa proses', async () => {
    promptId = await createPrompt({ subject: 'bahasa' });
    assignmentId = await createAssignment(promptId, classId, `Ujian-PIPE3-${Date.now().toString().slice(-6)}`);
    const subId = await createSubmission(assignmentId, siswaId, 'sudah dinilai', 'graded');

    const r = await processSubmission(subId, adapter);
    expect(r.status).toBe('graded');
  });

  it('adapter throw → error diteruskan, status kembali pending (rollback)', async () => {
    promptId = await createPrompt({ subject: 'bahasa' });
    assignmentId = await createAssignment(promptId, classId, `Ujian-PIPE4-${Date.now().toString().slice(-6)}`);
    const subId = await createSubmission(
      assignmentId,
      siswaId,
      'Teks uji yang cukup panjang agar lolos filter unscorable dan masuk ke tahap grade oleh adapter.',
      'pending',
    );

    const failing = {
      mode: 'mock',
      grade: async () => {
        throw new Error('provider error');
      },
    };
    await expect(processSubmission(subId, failing as never)).rejects.toThrow(/provider error/);
    const { rows } = await pool.query(`SELECT status FROM submissions WHERE id = $1`, [subId]);
    expect(rows[0]!.status).toBe('pending');
  });

  it('rubric JSON rusak → safeParseRubric mengembalikan [] dan tetap graded', async () => {
    promptId = await createPrompt({ subject: 'bahasa', rubric: [{}], maxScore: 100 });
    // Rusak rubric_json langsung
    await pool.query(`UPDATE prompts SET rubric_json = '{rusak' WHERE id = $1`, [promptId]);
    assignmentId = await createAssignment(promptId, classId, `Ujian-PIPE5-${Date.now().toString().slice(-6)}`);
    const subId = await createSubmission(
      assignmentId,
      siswaId,
      'Rubrik rusak tidak boleh menghentikan grading dan teks ini cukup panjang untuk dinilai oleh sistem secara normal.',
      'pending',
    );

    const r = await processSubmission(subId, adapter);
    expect(['graded', 'needs_review']).toContain(r.status);
  });
});