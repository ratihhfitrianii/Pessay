import { pool } from '../lib/pg';
import { AppError } from '../lib/errors';
import type { GradingAdapter, GradingInput, GradingResult, IntegrityReport, RubricDimension } from './types';
import { analyzeIntegrity } from './integrity';

/**
 * Pipeline grading satu submission:
 *   claim (FOR UPDATE SKIP LOCKED via worker) → integrity check →
 *   adapter.grade() → persist scores/feedback/anomalies → status final.
 *
 * dipanggil per submission oleh BatchGrader.
 */
export async function processSubmission(
  submissionId: number,
  adapter: GradingAdapter,
): Promise<{ status: string; score: number | null }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock baris submission — mencegah worker ganda memproses sama.
    const { rows } = await client.query(
      `SELECT s.id, s.body, s.status, p.subject, p.language, p.instructions,
              p.rubric_json, p.max_score
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN prompts p ON p.id = a.prompt_id
       WHERE s.id = $1
       FOR UPDATE`,
      [submissionId],
    );
    const row = rows[0] as
      | { id: string; body: string; status: string; subject: 'bahasa' | 'matematika'; language: string; instructions: string; rubric_json: string; max_score: string }
      | undefined;

    if (!row) {
      await client.query('ROLLBACK');
      throw new AppError('NOT_FOUND', `Submission ${submissionId} tidak ditemukan`, 404);
    }
    if (!['pending', 'processing'].includes(row.status)) {
      await client.query('ROLLBACK');
      return { status: row.status, score: null };
    }

    await client.query(`UPDATE submissions SET status = 'processing' WHERE id = $1`, [submissionId]);

    const rubric = safeParseRubric(row.rubric_json);
    const integrity: IntegrityReport = analyzeIntegrity(row.body);

    // Unscorable: alihkan ke review manusia, jangan nilai AI.
    if (integrity.unscorable || integrity.anomalies.some((a) => a.type === 'unscorable')) {
      await client.query(
        `UPDATE submissions SET status = 'unscorable', anomaly_json = $2, feedback_json = '[]' WHERE id = $1`,
        [submissionId, JSON.stringify(integrity.anomalies)],
      );
      await client.query('COMMIT');
      return { status: 'unscorable', score: null };
    }

    const input: GradingInput = {
      submissionId: Number(row.id),
      body: row.body,
      subject: row.subject,
      language: row.language,
      instructions: row.instructions,
      rubric,
      maxScore: Number(row.max_score),
    };

    const result: GradingResult = await adapter.grade(input);

    // Persist scores per dimensi + feedback + anomali + status akhir.
    await client.query(`DELETE FROM scores WHERE submission_id = $1`, [submissionId]);
    for (const d of result.dimensions) {
      await client.query(
        `INSERT INTO scores (submission_id, dimension, score, max_score, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [submissionId, d.name, d.score, d.max, d.comment],
      );
    }

    const needsReview = result.confidence < 0.5 || integrity.anomalies.length > 0;
    const status = needsReview ? 'needs_review' : 'graded';

    await client.query(
      `UPDATE submissions
       SET status = $2, score = $3, feedback_json = $4, anomaly_json = $5, graded_at = now()
       WHERE id = $1`,
      [
        submissionId,
        status,
        result.overallScore,
        JSON.stringify({
          feedback: result.feedback,
          strengths: result.strengths,
          improvements: result.improvements,
          confidence: result.confidence,
          mathCorrect: result.subject === 'matematika' ? result.mathCorrect : undefined,
          correctAnswer: result.subject === 'matematika' ? result.correctAnswer : undefined,
        }),
        JSON.stringify(integrity.anomalies),
      ],
    );

    await client.query('COMMIT');
    return { status, score: result.overallScore };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

function safeParseRubric(raw: string): RubricDimension[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
      .map((x) => ({
        name: String(x.name ?? 'Dimensi'),
        max: Number(x.max ?? 100),
        description: String(x.description ?? ''),
      }));
  } catch {
    return [];
  }
}