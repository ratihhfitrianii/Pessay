import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../lib/pg';
import { requireAuth, requireRole } from '../../middleware/auth';
import { AppError, asyncHandler, parseOrThrow } from '../../lib/errors';

/**
 * Admin: manajemen user (buat akun siswa/guru, aktif/nonaktif), kelas, enrollments.
 */
export function createAdminRouter(): Router {
  const router = Router();

  // -- Classes ---------------------------------------------------------
  router.get(
    '/classes',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (_req, res) => {
      const { rows } = await pool.query(
        `SELECT c.id, c.code, c.name, c.teacher_id, u.full_name AS teacher_name,
                (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id) AS student_count
         FROM classes c LEFT JOIN users u ON u.id = c.teacher_id
         ORDER BY c.id`,
      );
      res.json({
        success: true,
        data: rows.map((r) => ({
          id: Number(r.id),
          code: r.code,
          name: r.name,
          teacherId: r.teacher_id === null ? null : Number(r.teacher_id),
          teacherName: r.teacher_name,
          studentCount: Number(r.student_count),
        })),
      });
    }),
  );

  router.post(
    '/classes',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(
        z.object({ code: z.string().min(2).max(32), name: z.string().min(2).max(120), teacherId: z.number().int().positive().optional() }),
        req.body,
      );
      const { rows } = await pool.query(
        `INSERT INTO classes (code, name, teacher_id) VALUES ($1, $2, $3) RETURNING id`,
        [body.code, body.name, body.teacherId ?? null],
      );
      res.status(201).json({ success: true, data: { id: Number(rows[0]!.id) } });
    }),
  );

  // -- Enrollments -----------------------------------------------------
  router.post(
    '/classes/:classId/enroll',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const classId = Number(req.params.classId ?? 0);
      const body = parseOrThrow(z.object({ studentIds: z.array(z.number().int().positive()).min(1).max(1000) }), req.body);
      let created = 0;
      for (const sid of body.studentIds) {
        const { rowCount } = await pool.query(
          `INSERT INTO enrollments (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [classId, sid],
        );
        created += rowCount ?? 0;
      }
      res.json({ success: true, data: { created } });
    }),
  );

  // -- Users -----------------------------------------------------------
  router.get(
    '/users',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (_req, res) => {
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.full_name, r.code AS role_code, u.is_active, u.created_at
         FROM users u JOIN roles r ON r.id = u.role_id
         ORDER BY u.id`,
      );
      res.json({
        success: true,
        data: rows.map((r) => ({
          id: Number(r.id),
          email: r.email,
          fullName: r.full_name,
          role: r.role_code,
          isActive: r.is_active,
          createdAt: r.created_at,
        })),
      });
    }),
  );

  router.post(
    '/users',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(
        z.object({
          email: z.string().email(),
          password: z.string().min(6).max(100),
          fullName: z.string().min(2).max(120),
          role: z.enum(['guru', 'siswa']),
        }),
        req.body,
      );
      const bcrypt = (await import('bcryptjs')).default;
      const hash = bcrypt.hashSync(body.password, 12);
      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role_id)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = $4)) RETURNING id`,
        [body.email, hash, body.fullName, body.role],
      );
      res.status(201).json({ success: true, data: { id: Number(rows[0]!.id) } });
    }),
  );

  router.patch(
    '/users/:id',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id ?? 0);
      const body = parseOrThrow(
        z.object({ fullName: z.string().min(2).max(120).optional(), isActive: z.boolean().optional() }),
        req.body,
      );
      const { rows } = await pool.query(
              `UPDATE users SET full_name = COALESCE($2, full_name), is_active = COALESCE($3, is_active)
               WHERE id = $1 RETURNING id, is_active`,
              [id, body.fullName ?? null, body.isActive === undefined ? null : body.isActive],
            );
            if (!rows[0]) throw new AppError('NOT_FOUND', 'User tidak ditemukan', 404);
            res.json({
              success: true,
              data: { id: Number(rows[0].id), isActive: rows[0].is_active },
            });
    }),
  );

  // -- Stats -----------------------------------------------------------
  router.get(
    '/stats',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (_req, res) => {
      const { rows } = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM users) AS users,
           (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE code='siswa')) AS students,
           (SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE code='guru')) AS teachers,
           (SELECT COUNT(*) FROM classes) AS classes,
           (SELECT COUNT(*) FROM assignments) AS assignments,
           (SELECT COUNT(*) FROM submissions) AS submissions,
           (SELECT COUNT(*) FROM submissions WHERE status='pending') AS pending,
           (SELECT COUNT(*) FROM submissions WHERE status='needs_review') AS needs_review,
           (SELECT COUNT(*) FROM submissions WHERE status='unscorable') AS unscorable,
           (SELECT ROUND(AVG(score)::numeric, 2) FROM submissions WHERE score IS NOT NULL) AS avg_score`,
      );
      const r = rows[0]!;
      res.json({
        success: true,
        data: {
          users: Number(r.users),
          students: Number(r.students),
          teachers: Number(r.teachers),
          classes: Number(r.classes),
          assignments: Number(r.assignments),
          submissions: Number(r.submissions),
          pending: Number(r.pending),
          needsReview: Number(r.needs_review),
          unscorable: Number(r.unscorable),
          avgScore: r.avg_score === null ? null : Number(r.avg_score),
        },
      });
    }),
  );

  return router;
}