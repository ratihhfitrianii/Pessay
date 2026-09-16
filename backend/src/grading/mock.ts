import type {
  GradingAdapter,
  GradingInput,
  GradingResult,
  RubricDimension,
} from "./types";

/**
 * Mock grading adapter — berjalan TANPA API key.
 * Menghasilkan skor deterministik berbasis fitur teks sederhana (panjang,
 * jumlah kalimat, keragaman kosakata) sehingga demo/tes bisa dijalankan
 * ujung-ke-ujung. Realitas: pakai Gemini adapter ketika GRADING_MODE=real.
 */
export class MockGradingAdapter implements GradingAdapter {
  readonly mode = "mock" as const;

  async grade(input: GradingInput): Promise<GradingResult> {
    const words = input.body.trim().split(/\s+/).filter(Boolean);
    const sentences = input.body
      .split(/[.!?。！？\n]+/)
      .filter((s) => s.trim().length > 0);
    const uniq = new Set(words.map((w) => w.toLowerCase())).size;

    const lengthScore = Math.min(1, words.length / 120);
    const structureScore = Math.min(1, sentences.length / 5);
    const vocabScore =
      words.length > 0
        ? Math.min(1, uniq / Math.max(words.length, 1) / 0.7)
        : 0;

    const dims: RubricDimension[] =
      input.rubric.length > 0
        ? input.rubric
        : [{ name: "Kualitas", max: input.maxScore, description: "" }];

    const dimensions = dims.map((d, i) => {
      const base = [lengthScore, structureScore, vocabScore][i % 3] ?? 0.6;
      const score =
        Math.round(Math.max(0.35, Math.min(0.98, base)) * d.max * 100) / 100;
      return {
        name: d.name,
        score,
        max: d.max,
        comment: `Skor ${d.name} berdasarkan panjang, struktur, dan variasi kosakata.`,
      };
    });

    const overall =
      Math.round(dimensions.reduce((s, d) => s + d.score, 0) * 100) / 100;
    const confidence =
      Math.round(Math.min(0.95, 0.5 + lengthScore * 0.4) * 100) / 100;

    if (input.subject === "matematika") {
      // Mock: anggap benar jika jawaban memuat bentuk penyelesaian (=, hasil, x = ...).
      const mathCorrect =
        /=/.test(input.body) ||
        /hasil akhir/i.test(input.body) ||
        /\b(x|y|z)\s*=/.test(input.body);
      return {
        subject: "matematika",
        overallScore: overall,
        dimensions,
        feedback: [
          "Langkah pengerjaan teridentifikasi.",
          "Jawaban akhir diperiksa.",
        ],
        strengths: ["Menunjukkan langkah penyelesaian."],
        improvements: ["Periksa kembali perhitungan akhir."],
        confidence,
        mathCorrect,
        correctAnswer: undefined,
      };
    }

    return {
      subject: "bahasa",
      overallScore: overall,
      dimensions,
      feedback: [
        "Teks memiliki struktur yang jelas.",
        "Kosa kata cukup bervariasi.",
      ],
      strengths: ["Gagasan utama tersampaikan."],
      improvements: ["Kembangkan ide dengan contoh konkret."],
      confidence,
    };
  }
}
