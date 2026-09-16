import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../lib/pg';
import { requireAuth, requireRole } from '../../middleware/auth';
import { AppError, asyncHandler, parseOrThrow } from '../../lib/errors';

const createSchema = z.object({
  assignmentId: z.number().int().positive(),
  body: z.string().min(1, 'Jawaban tidak boleh kosong').max(20000, 'Jawaban terlalu panjang (maks 20.000 karakter)'),
  answerImage: z.string().optional(), // base64 — untuk matematika/scan (disimpan sebagai metadata)
});

/**
 * Endpoint kirim esai. Kritikal untuk 2.000 concurrent:
 * - Validasi sesi (JWT) → verifikasi enrollment → INSERT → return 202 INSTAN.
 *   Tidak ada kerja AI sinkron; worker batch yang menilai.
 */
export function createSubmissionsRouter(): Router {
  const router = Router();

  router.post(
    '/submit',
    requireAuth,
    asyncHandler(async (req, res) => {
      assertCanSubmit(req.user!.role);
      const body = parseOrThrow(createSchema, req.body);

      // Rate limit per user: max 1 kiriman per 10 detik (double-click / DDoS app).
      const { rows: recent } = await pool.query(
        `SELECT 1 FROM submissions WHERE student_id = $1 AND submitted_at > now() - interval '10 seconds' LIMIT 1`,
        [req.user!.id],
      );
      if (recent.length > 0) {
        throw new AppError('RATE_LIMITED', 'Terlalu cepat mengirim. Tunggu 10 detik sebelum kirim lagi.', 429);
      }

      // Verifikasi assignment + enrollment siswa di kelasnya.
      const { rows: asg } = await pool.query(
        `SELECT a.id, a.class_id, a.is_active,
                (SELECT 1 FROM enrollments e WHERE e.class_id = a.class_id AND e.student_id = $2) AS enrolled
         FROM assignments a WHERE a.id = $1`,
        [body.assignmentId, req.user!.id],
      );
      const assignment = asg[0] as
        | { id: string; class_id: string; is_active: boolean; enrolled: string | null }
        | undefined;
      if (!assignment) throw new AppError('NOT_FOUND', 'Ujian tidak ditemukan', 404);
      if (!assignment.enrolled) throw new AppError('FORBIDDEN', 'Anda tidak terdaftar di kelas ujian ini', 403);
      if (!assignment.is_active) throw new AppError('ASSIGNMENT_CLOSED', 'Ujian sudah ditutup', 403);

      const answerImage = body.answerImage ?? null;
      const { rows } = await pool.query(
        `INSERT INTO submissions (assignment_id, student_id, body, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id`,
        [body.assignmentId, req.user!.id, answerImage ? `[gambar] ${body.body}` : body.body],
      );
      const id = Number(rows[0]!.id);

      res.status(202).json({
        success: true,
        data: { id, status: 'pending', message: 'Jawaban diterima. Penilaian sedang diproses.' },
      });
    }),
  );

  // Polling hasil — siswa melihat status + skor + feedback.
  router.get(
    '/my/:assignmentId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const assignmentId = Number(req.params.assignmentId ?? 0);
      const { rows } = await pool.query(
        `SELECT s.id, s.status, s.score, s.feedback_json, s.anomaly_json, s.submitted_at, s.graded_at
         FROM submissions s WHERE s.assignment_id = $1 AND s.student_id = $2`,
        [assignmentId, req.user!.id],
      );
      const sub = rows[0] as
        | {
            id: string;
            status: string;
            score: string | null;
            feedback_json: string | null;
            anomaly_json: string;
            submitted_at: string;
            graded_at: string | null;
          }
        | undefined;
      if (!sub) throw new AppError('NOT_FOUND', 'Belum ada kiriman untuk ujian ini', 404);

      res.json({
        success: true,
        data: {
          id: Number(sub.id),
          status: sub.status,
          score: sub.score === null ? null : Number(sub.score),
          feedback: sub.feedback_json ? safeParse(sub.feedback_json) : null,
          anomalies: safeParse(sub.anomaly_json),
          submittedAt: sub.submitted_at,
          gradedAt: sub.graded_at,
        },
      });
    }),
  );

  // Guru: daftar kiriman per assignment (dengan skor).
  router.get(
    '/assignment/:assignmentId',
    requireAuth,
    requireRole('guru', 'admin'),
    asyncHandler(async (req, res) => {
      const assignmentId = Number(req.params.assignmentId ?? 0);
      const { rows } = await pool.query(
        `SELECT s.id, s.student_id, u.full_name, s.status, s.score, s.submitted_at, s.graded_at,
                s.feedback_json, s.anomaly_json
         FROM submissions s
         JOIN users u ON u.id = s.student_id
         WHERE s.assignment_id = $1
         ORDER BY s.id`,
        [assignmentId],
      );
      res.json({
        success: true,
        data: rows.map((r) => ({
          id: Number(r.id),
          studentId: Number(r.student_id),
          studentName: r.full_name,
          status: r.status,
          score: r.score === null ? null : Number(r.score),
          submittedAt: r.submitted_at,
          gradedAt: r.graded_at,
          feedback: r.feedback_json ? safeParse(r.feedback_json) : null,
          anomalies: safeParse(r.anomaly_json),
        })),
      });
    }),
  );

  // Guru: tinjau manual esai needs_review / unscorable → beri skor/ganti status.
  router.put(
    '/:submissionId/review',
    requireAuth,
    requireRole('guru', 'admin'),
    asyncHandler(async (req, res) => {
      const submissionId = Number(req.params.submissionId ?? 0);
      const body = parseOrThrow(
        z.object({ status: z.enum(['graded', 'needs_review']), score: z.number().min(0).max(100).optional() }),
        req.body,
      );
      const { rows } = await pool.query(
        `UPDATE submissions SET status = $2, score = COALESCE($3, score), graded_at = now()
         WHERE id = $1 RETURNING id, status, score`,
        [submissionId, body.status, body.score === undefined ? null : body.score],
      );
      if (!rows[0]) throw new AppError('NOT_FOUND', 'Kiriman tidak ditemukan', 404);
      res.json({
        success: true,
        data: {
          id: Number(rows[0].id),
          status: rows[0].status,
          score: rows[0].score === null ? null : Number(rows[0].score),
        },
      });
    }),
  );

  return router;
}

function assertCanSubmit(role: string): void {
  if (role !== 'siswa') throw new AppError('FORBIDDEN', 'Hanya siswa yang bisa mengirim jawaban', 403);
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}