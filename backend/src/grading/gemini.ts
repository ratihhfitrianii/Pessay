import type { GradingAdapter, GradingInput, GradingResult, RubricDimension } from './types';
import { AppError } from '../lib/errors';
import { MockGradingAdapter } from './mock';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Real grading adapter — Google Gemini Flash (BYOK).
 * Mendukung semua bahasa (Arab, Korea, Jepang, dll.) dan matematika (LaTeX).
 * Prompt meminta JSON terstruktur; hasil diparse dan divalidasi.
 */
export class GeminiGradingAdapter implements GradingAdapter {
  readonly mode = 'real' as const;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    if (!apiKey) throw new AppError('CONFIG_ERROR', 'GEMINI_API_KEY wajib diisi saat GRADING_MODE=real', 500);
    this.apiKey = apiKey;
    this.model = model;
  }

  async grade(input: GradingInput): Promise<GradingResult> {
    const prompt = buildPrompt(input);
    const url = `${API_URL}/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              overallScore: { type: 'NUMBER' },
              dimensions: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    score: { type: 'NUMBER' },
                    max: { type: 'NUMBER' },
                    comment: { type: 'STRING' },
                  },
                },
              },
              feedback: { type: 'ARRAY', items: { type: 'STRING' } },
              strengths: { type: 'ARRAY', items: { type: 'STRING' } },
              improvements: { type: 'ARRAY', items: { type: 'STRING' } },
              confidence: { type: 'NUMBER' },
              mathCorrect: { type: 'BOOLEAN' },
              correctAnswer: { type: 'STRING' },
            },
            required: ['overallScore', 'dimensions', 'feedback', 'strengths', 'improvements', 'confidence'],
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError('AI_PROVIDER_ERROR', `Gemini API gagal (${res.status}): ${text.slice(0, 200)}`, 502);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AppError('AI_PROVIDER_ERROR', 'Gemini tidak mengembalikan konten', 502);

    const raw = JSON.parse(text) as Record<string, unknown>;
    return normalizeResult(raw, input);
  }
}

function buildPrompt(input: GradingInput): string {
  const rubric = input.rubric
    .map((d) => `- ${d.name} (maks ${d.max}): ${d.description}`)
    .join('\n');

  return [
    `Anda adalah penilai esai profesional. Nilailah jawaban siswa berikut berdasarkan rubrik.`,
    ``,
    `Soal: ${input.instructions}`,
    `Subjek: ${input.subject === 'matematika' ? 'Matematika' : 'Bahasa'}`,
    `Bahasa jawaban: ${input.language}`,
    `Skor maksimal: ${input.maxScore}`,
    ``,
    `Rubrik:`,
    rubric || '(tidak ada rubrik khusus — nilai kualitas umum)',
    ``,
    `Jawaban siswa:`,
    input.body,
    ``,
    `Kembalikan JSON dengan:`,
    `- overallScore: angka (0..${input.maxScore})`,
    `- dimensions: array {name, score, max, comment}`,
    `- feedback, strengths, improvements: array string (dalam bahasa jawaban siswa)`,
    `- confidence: 0..1 (keyakinan Anda)`,
    input.subject === 'matematika'
      ? `- mathCorrect: boolean (apakah hasil akhir benar), correctAnswer: string (jawaban yang benar bila berbeda)`
      : ``,
    ``,
    `Jika jawaban kosong/tidak relevan, beri skor 0. Jangan beri skor tinggi untuk teks tidak bermakna.`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function normalizeResult(raw: Record<string, unknown>, input: GradingInput): GradingResult {
  const maxScore = input.maxScore;
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n * 100) / 100));

  const rawDims = Array.isArray(raw.dimensions) ? raw.dimensions : [];
  const dimensions = rawDims.map((d) => {
    const dim = d as Record<string, unknown>;
    return {
      name: String(dim.name ?? 'Dimensi'),
      score: clamp(Number(dim.score ?? 0), Number(dim.max ?? maxScore)),
      max: Number(dim.max ?? maxScore),
      comment: String(dim.comment ?? ''),
    };
  });

  const overall = clamp(Number(raw.overallScore ?? 0), maxScore);
  const confidence = clamp(Number(raw.confidence ?? 0.5), 1);

  const common = {
    overallScore: overall,
    dimensions:
      dimensions.length > 0
        ? dimensions
        : [{ name: 'Kualitas', score: overall, max: maxScore, comment: '' }],
    feedback: asStringArray(raw.feedback),
    strengths: asStringArray(raw.strengths),
    improvements: asStringArray(raw.improvements),
    confidence,
  };

  if (input.subject === 'matematika') {
    return {
      ...common,
      subject: 'matematika',
      mathCorrect: Boolean(raw.mathCorrect),
      correctAnswer: raw.correctAnswer ? String(raw.correctAnswer) : undefined,
    };
  }
  return { ...common, subject: 'bahasa' };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((s) => s.length > 0);
}

/** Factory — pilih adapter sesuai env. */
export function createGradingAdapter(mode: string, apiKey: string, model: string): GradingAdapter {
  if (mode === 'real') return new GeminiGradingAdapter(apiKey, model);
  return new MockGradingAdapter();
}

// Re-export RubricDimension agar konsumen cukup import dari sini.
export type { RubricDimension };