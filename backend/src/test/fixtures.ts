import { pool } from '../lib/pg';

/**
 * Fixture factory untuk tes integrasi.
 * Semua insert memakai data unik per run (ts) sehingga suite bisa dijalankan
 * berulang tanpa tabrakan, dan pembersihan memakai pola lebar (PESS-<ts>-%).
 */

let counter = 0;
let ts = '';
export function runToken(): string {
  if (!ts) ts = Date.now().toString().slice(-8);
  counter += 1;
  return `${ts}${counter.toString().padStart(3, '0')}`;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${runToken()}@pessay.test`;
}

/** Buat user + kembalikan { id, roleId, token } (login via API penuh). */
export async function createUser(
  role: 'guru' | 'siswa',
  email?: string,
): Promise<{ id: number; email: string; password: string }> {
  const bcrypt = (await import('bcryptjs')).default;
  const password = 'Password123!';
  const mail = email ?? uniqueEmail(role);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role_id)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = $4))
     RETURNING id`,
    [mail, bcrypt.hashSync(password, 12), `User ${role} ${runToken()}`, role],
  );
  return { id: Number(rows[0]!.id), email: mail, password };
}

export async function createClass(code?: string, teacherId?: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO classes (code, name, teacher_id) VALUES ($1, $2, $3) RETURNING id`,
    [code ?? `CLS-${runToken()}`, `Kelas ${runToken()}`, teacherId ?? null],
  );
  return Number(rows[0]!.id);
}

export async function enroll(classId: number, studentId: number): Promise<void> {
  await pool.query(`INSERT INTO enrollments (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    classId,
    studentId,
  ]);
}

export async function createPrompt(
  overrides: { subject?: 'bahasa' | 'matematika'; language?: string; rubric?: unknown[]; maxScore?: number } = {},
): Promise<number> {
  const subject = overrides.subject ?? 'bahasa';
  const { rows } = await pool.query(
    `INSERT INTO prompts (title, subject, language, instructions, rubric_json, max_score)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      `Soal ${runToken()} ${subject}`,
      subject,
      overrides.language ?? 'id',
      'Jelaskan pendapat Anda secara lengkap dan berikan contoh.',
      JSON.stringify(overrides.rubric ?? []),
      overrides.maxScore ?? 100,
    ],
  );
  return Number(rows[0]!.id);
}

export async function createAssignment(promptId: number, classId: number, title?: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO assignments (prompt_id, class_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [promptId, classId, title ?? `Ujian ${runToken()}`],
  );
  return Number(rows[0]!.id);
}

export async function createSubmission(
  assignmentId: number,
  studentId: number,
  body: string,
  status = 'pending',
): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO submissions (assignment_id, student_id, body, status, submitted_at)
     VALUES ($1, $2, $3, $4, now() - interval '30 seconds') RETURNING id`,
    [assignmentId, studentId, body, status],
  );
  return Number(rows[0]!.id);
}

/** Pembersihan lebar: hapus semua data tes pola PESS/CLS/Ujian/User-tes. */
export async function cleanupTestData(): Promise<void> {
  const like = `PESS-${runToken()}-%`;
  await pool.query(`DELETE FROM submissions WHERE student_id IN (SELECT id FROM users WHERE email LIKE $1)`, [like]);
  await pool.query(
    `DELETE FROM scores WHERE submission_id IN (SELECT s.id FROM submissions s JOIN users u ON u.id = s.student_id WHERE u.email LIKE $1)`,
    [like],
  );
  await pool.query(`DELETE FROM anomalies WHERE submission_id IN (SELECT s.id FROM submissions s JOIN users u ON u.id = s.student_id WHERE u.email LIKE $1)`, [like]);
  await pool.query(`DELETE FROM assignments WHERE title LIKE $1`, [`Ujian ${runToken()}%`]);
  await pool.query(`DELETE FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE code LIKE $1)`, [like]);
  await pool.query(`DELETE FROM classes WHERE code LIKE $1`, [like]);
  await pool.query(`DELETE FROM prompts WHERE title LIKE $1`, [`Soal ${runToken()} %`]);
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [like]);
}