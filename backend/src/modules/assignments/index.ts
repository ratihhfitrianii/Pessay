import { Router } from "express";
import { z } from "zod";
import { pool } from "../../lib/pg";
import { requireAuth, requireRole } from "../../middleware/auth";
import { AppError, asyncHandler, parseOrThrow } from "../../lib/errors";

const assignmentSchema = z.object({
  promptId: z.number().int().positive(),
  classId: z.number().int().positive(),
  title: z.string().min(3).max(200),
  dueAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

export function createAssignmentsRouter(): Router {
  const router = Router();

  // Buat ujian (guru/admin).
  router.post(
    "/",
    requireAuth,
    requireRole("guru", "admin"),
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(assignmentSchema, req.body);
      const { rows } = await pool.query(
        `INSERT INTO assignments (prompt_id, class_id, title, due_at, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          body.promptId,
          body.classId,
          body.title,
          body.dueAt ?? null,
          body.isActive,
        ],
      );
      res
        .status(201)
        .json({ success: true, data: { id: Number(rows[0]!.id) } });
    }),
  );

  // Daftar ujian (guru: milik kelasnya; admin: semua).
  router.get(
    "/",
    requireAuth,
    requireRole("guru", "admin"),
    asyncHandler(async (req, res) => {
      const { rows } = await pool.query(
        `SELECT a.id, a.title, a.due_at, a.is_active, a.class_id, c.name AS class_name,
                p.title AS prompt_title, p.subject, p.language,
                (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count
         FROM assignments a
         JOIN classes c ON c.id = a.class_id
         JOIN prompts p ON p.id = a.prompt_id
         ORDER BY a.id DESC`,
      );
      res.json({
        success: true,
        data: rows.map((r) => ({
          id: Number(r.id),
          title: r.title,
          dueAt: r.due_at,
          isActive: r.is_active,
          classId: Number(r.class_id),
          className: r.class_name,
          promptTitle: r.prompt_title,
          subject: r.subject,
          language: r.language,
          submissionCount: Number(r.submission_count),
        })),
      });
    }),
  );

  // Ujian aktif untuk siswa (kelasnya, yang masih terbuka).
  router.get(
    "/available",
    requireAuth,
    requireRole("siswa"),
    asyncHandler(async (req, res) => {
      const { rows } = await pool.query(
        `SELECT a.id, a.title, a.due_at, a.is_active, c.name AS class_name,
                p.title AS prompt_title, p.subject, p.language, p.instructions, p.max_score, p.rubric_json
         FROM assignments a
         JOIN classes c ON c.id = a.class_id
         JOIN prompts p ON p.id = a.prompt_id
         JOIN enrollments e ON e.class_id = a.class_id AND e.student_id = $1
         WHERE a.is_active = TRUE
         ORDER BY a.id DESC`,
        [req.user!.id],
      );
      res.json({
        success: true,
        data: rows.map((r) => ({
          id: Number(r.id),
          title: r.title,
          dueAt: r.due_at,
          className: r.class_name,
          promptTitle: r.prompt_title,
          subject: r.subject,
          language: r.language,
          instructions: r.instructions,
          maxScore: Number(r.max_score),
          rubric: safeParse(r.rubric_json),
        })),
      });
    }),
  );

  // Nonaktifkan / aktifkan ujian.
  router.patch(
    "/:id",
    requireAuth,
    requireRole("guru", "admin"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id ?? 0);
      const body = parseOrThrow(z.object({ isActive: z.boolean() }), req.body);
      const { rows } = await pool.query(
        `UPDATE assignments SET is_active = $2 WHERE id = $1 RETURNING id, is_active`,
        [id, body.isActive],
      );
      if (!rows[0])
        throw new AppError("NOT_FOUND", "Ujian tidak ditemukan", 404);
      res.json({
        success: true,
        data: { id: Number(rows[0].id), isActive: rows[0].is_active },
      });
    }),
  );

  return router;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
