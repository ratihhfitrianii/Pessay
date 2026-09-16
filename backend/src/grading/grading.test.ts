import { MockGradingAdapter } from './mock';
import { analyzeIntegrity } from './integrity';
import { BatchGrader } from './batch';
import { pool } from '../lib/pg';
import { createPrompt, createClass, createAssignment, createSubmission, cleanupTestData } from '../test/fixtures';

const adapter = new MockGradingAdapter();

describe('integrity (deteksi anomali)', () => {
  it('teks normal → tidak ada anomali', () => {
    const r = analyzeIntegrity(
      'Saya percaya pendidikan adalah kunci masa depan. Dengan belajar keras, kita bisa meraih cita-cita. Setiap anak berhak mendapat pendidikan yang layak.',
    );
    expect(r.unscorable).toBe(false);
    expect(r.anomalies).toHaveLength(0);
  });

  it('teks terlalu pendek → unscorable', () => {
    const r = analyzeIntegrity('ya');
    expect(r.unscorable).toBe(true);
    expect(r.anomalies[0]?.type).toBe('unscorable');
  });

  it('paragraf identik berulang → repetition', () => {
    const para =
      'Indonesia adalah negara kepulauan terbesar di dunia dengan ribuan pulau yang tersebar dari Sabang sampai Merauke dan dihuni oleh ratusan suku bangsa yang berbeda.';
    const body = `${para}\n${para}\n${para}\n${para}`;
    const r = analyzeIntegrity(body);
    expect(r.unscorable).toBe(false);
    expect(r.anomalies.some((a) => a.type === 'repetition')).toBe(true);
  });

  it('token tidak wajar dominan → unscorable', () => {
    const r = analyzeIntegrity('qwerty asdfgh zxcvbn poiuy lkjhg mnbvc lkjhgf');
    expect(r.unscorable).toBe(true);
  });
});

describe('mock grading adapter', () => {
  it('menghasilkan skor valid untuk bahasa', async () => {
    const r = await adapter.grade({
      submissionId: 1,
      body: 'Pendidikan sangat penting bagi masa depan setiap anak bangsa dan negara kita tercinta ini.',
      subject: 'bahasa',
      language: 'id',
      instructions: 'Jelaskan pentingnya pendidikan.',
      rubric: [
        { name: 'Isi', max: 40, description: 'Relevansi dan kedalaman' },
        { name: 'Organisasi', max: 30, description: 'Struktur' },
        { name: 'Bahasa', max: 30, description: 'Tata bahasa' },
      ],
      maxScore: 100,
    });
    expect(r.subject).toBe('bahasa');
    expect(r.overallScore).toBeGreaterThan(0);
    expect(r.dimensions).toHaveLength(3);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('menghasilkan hasil matematika dengan mathCorrect', async () => {
      const r = await adapter.grade({
        submissionId: 2,
        body: 'Pertama, kita kalikan kedua ruas dengan 2 sehingga diperoleh 2x sama dengan 12. Kemudian kita kurangi dengan 4 dan bagi kedua ruas dengan 2. Hasil akhirnya adalah x sama dengan 6, jadi penyelesaian persamaan tersebut adalah x = 6. Langkah pengerjaan sudah benar karena kita mengikuti aturan aljabar dengan teliti dan memeriksa kembali setiap langkah perhitungan hingga memperoleh jawaban yang tepat dan konsisten.',
        subject: 'matematika',
        language: 'id',
        instructions: 'Selesaikan persamaan 2x + 4 = 16.',
        rubric: [{ name: 'Langkah', max: 50, description: 'Proses' }, { name: 'Jawaban', max: 50, description: 'Hasil akhir' }],
        maxScore: 100,
      });
    if (r.subject === 'matematika') {
      expect(r.mathCorrect).toBe(true);
      expect(r.feedback.length).toBeGreaterThan(0);
    } else {
      throw new Error('seharusnya matematika');
    }
  });
});

describe('batch grader (pipeline end-to-end)', () => {
  let promptId: number;
  let classId: number;
  let assignmentId: number;
  let studentId: number;
  let subId: number;

  beforeAll(async () => {
      // Bersihkan semua submission pending dari suite lain agar tick() hanya
      // memproses submission milik test ini.
      await pool.query(`DELETE FROM submissions WHERE status = 'pending'`);
      promptId = await createPrompt({ subject: 'bahasa', maxScore: 100 });
    classId = await createClass();
    assignmentId = await createAssignment(promptId, classId);
    const bcrypt = (await import('bcryptjs')).default;
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code='siswa')) RETURNING id`,
      [`siswa-batch-${Date.now()}@pessay.test`, bcrypt.hashSync('Password123!', 12), 'Siswa Batch'],
    );
    studentId = Number(rows[0]!.id);
    subId = await createSubmission(
      assignmentId,
      studentId,
      'Pendidikan adalah fondasi kemajuan bangsa dan setiap warga negara berhak memperoleh pendidikan yang bermutu serta terjangkau.',
      'pending',
    );
  }, 30000);

  afterAll(async () => {
    await pool.query(`DELETE FROM submissions WHERE id = $1`, [subId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [studentId]);
    await pool.query(`DELETE FROM assignments WHERE id = $1`, [assignmentId]);
    await pool.query(`DELETE FROM classes WHERE id = $1`, [classId]);
    await pool.query(`DELETE FROM prompts WHERE id = $1`, [promptId]);
    await cleanupTestData();
  });

  it('worker memproses submission pending → graded', async () => {
    const grader = new BatchGrader(adapter, 5, 10, 2);
    const result = await grader.tick();
    expect(result.processed).toBe(1);

    const { rows } = await pool.query(`SELECT status, score FROM submissions WHERE id = $1`, [subId]);
    expect(rows[0]!.status).toBe('graded');
    expect(Number(rows[0]!.score)).toBeGreaterThan(0);

    const scores = await pool.query(`SELECT dimension, score FROM scores WHERE submission_id = $1`, [subId]);
    expect(scores.rows.length).toBeGreaterThan(0);
  });

  it('tick kedua tanpa pending → processed 0', async () => {
    const grader = new BatchGrader(adapter, 5, 10, 2);
    const result = await grader.tick();
    expect(result.processed).toBe(0);
  });
});