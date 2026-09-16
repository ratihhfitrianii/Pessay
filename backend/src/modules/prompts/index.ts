import { Router } from "express";
import { z } from "zod";
import { pool } from "../../lib/pg";
import { requireAuth, requireRole } from "../../middleware/auth";
import { AppError, asyncHandler, parseOrThrow } from "../../lib/errors";

const promptSchema = z.object({
  title: z.string().min(3).max(200),
  subject: z.enum(["bahasa", "matematika"]),
  language: z.string().min(2).max(30).default("id"),
  instructions: z.string().min(5).max(5000),
  rubric: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        max: z.number().int().min(1).max(1000),
        description: z.string().max(500).default(""),
      }),
    )
    .max(10)
    .default([]),
  maxScore: z.number().int().min(1).max(1000).default(100),
});

export function createPromptsRouter(): Router {
  const router = Router();

  // Daftar soal — guru/admin; filter by subject/language.
  router.get(
    "/",
    requireAuth,
    requireRole("guru", "admin"),
    asyncHandler(async (req, res) => {
      const subject = req.query.subject ? String(req.query.subject) : null;
      const language = req.query.language ? String(req.query.language) : null;
      const { rows } = await pool.query(
        `SELECT p.id, p.title, p.subject, p.language, p.instructions, p.rubric_json, p.max_score,
                p.created_at, u.full_name AS teacher_name
         FROM prompts p LEFT JOIN users u ON u.id = p.teacher_id
         WHERE ($1::text IS NULL OR p.subject = $1)
           AND ($2::text IS NULL OR p.language = $2)
         ORDER BY p.id DESC`,
        [subject, language],
      );
      res.json({
        success: true,
        data: rows.map((r) => ({
          id: Number(r.id),
          title: r.title,
          subject: r.subject,
          language: r.language,
          instructions: r.instructions,
          rubric: safeParse(r.rubric_json),
          maxScore: Number(r.max_score),
          createdAt: r.created_at,
          teacherName: r.teacher_name,
        })),
      });
    }),
  );

  // Buat soal.
  router.post(
    "/",
    requireAuth,
    requireRole("guru", "admin"),
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(promptSchema, req.body);
      const { rows } = await pool.query(
        `INSERT INTO prompts (title, subject, language, instructions, rubric_json, max_score, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          body.title,
          body.subject,
          body.language,
          body.instructions,
          JSON.stringify(body.rubric),
          body.maxScore,
          req.user!.id,
        ],
      );
      res
        .status(201)
        .json({ success: true, data: { id: Number(rows[0]!.id) } });
    }),
  );

  // Detail satu soal.
  router.get(
    "/:id",
    requireAuth,
    requireRole("guru", "admin"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id ?? 0);
      const { rows } = await pool.query(`SELECT * FROM prompts WHERE id = $1`, [
        id,
      ]);
      const p = rows[0] as Record<string, unknown> | undefined;
      if (!p) throw new AppError("NOT_FOUND", "Soal tidak ditemukan", 404);
      res.json({
        success: true,
        data: {
          id: Number(p.id),
          title: p.title,
          subject: p.subject,
          language: p.language,
          instructions: p.instructions,
          rubric: safeParse(String(p.rubric_json)),
          maxScore: Number(p.max_score),
          createdAt: p.created_at,
        },
      });
    }),
  );

  // Hapus soal.
  router.delete(
    "/:id",
    requireAuth,
    requireRole("guru", "admin"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id ?? 0);
      const { rows } = await pool.query(
        `DELETE FROM prompts WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!rows[0])
        throw new AppError("NOT_FOUND", "Soal tidak ditemukan", 404);
      res.json({ success: true, data: { id: Number(rows[0].id) } });
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
