import type { GradingResult, IntegrityReport } from './types';

/**
 * Analisis integritas berbasis pola (rule-based), berjalan SAYA.
 * Mendeteksi: pengulangan paragraf identik, teks tak bermakna/acak, dan
 * sinyal lemah teks yang tampak digenerate AI (varians kosakata berlebihan).
 */
function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function analyzeIntegrity(body: string): IntegrityReport {
  const anomalies: IntegrityReport['anomalies'] = [];
  const normalized = body.replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ');
  const wordCount = words.filter(Boolean).length;

  if (wordCount < 5) {
    anomalies.push({
      type: 'unscorable',
      confidence: 0.99,
      detail: 'Teks terlalu pendek untuk dinilai (kurang dari 5 kata).',
    });
    return { anomalies, unscorable: true };
  }

  // 1) Paragraph-identity repetition (copy-paste paragraf identik).
  const paragraphs = body.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 20);
  const seen = new Map<string, number>();
  let repScore = 0;
  for (const p of paragraphs) {
    const key = p.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (key.length < 30) continue;
    const c = (seen.get(key) ?? 0) + 1;
    seen.set(key, c);
    if (c >= 2) repScore += 0.3;
  }
  if (repScore >= 0.6 && paragraphs.length >= 3) {
    anomalies.push({
      type: 'repetition',
      confidence: Math.min(0.99, 0.5 + repScore * 0.5),
      detail: 'Terdeteksi pengulangan paragraf identik (salin-tempel).',
    });
  }

  // 2) Tekstur acak: token yang TIDAK mengandung satu pun huruf/angka dari
    //    alfabet umum mana pun (Latin, Arab, Cyrillic, CJK, Hangul) dianggap aneh.
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const LETTERISH =
      /[a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\uAC00-\uD7AF0-9]/;
    const weird: string[] = [];
    for (const t of tokens) {
      if (t.length <= 2) continue;
      const hasLetter = LETTERISH.test(t);
      if (!hasLetter) weird.push(t);
    }
    // 2b) Deretan token huruf-Latin TANPA vokal (qwerty, asdfgh, zxcvbn…) = ketikan acak.
    const VOWELISH = /[aiueoAIUEO]/;
    const vowelLess: string[] = [];
    for (const t of tokens) {
      if (t.length > 3 && LETTERISH.test(t) && !VOWELISH.test(t) && !/\d/.test(t)) {
        vowelLess.push(t);
      }
    }
    const suspicious = weird.length + vowelLess.length;
    if (suspicious > 0 && suspicious / Math.max(tokens.length, 1) > 0.4) {
    anomalies.push({
      type: 'unscorable',
      confidence: 0.9,
      detail: 'Teks mengandung banyak token tidak wajar (mungkin acak/rusak).',
    });
    return { anomalies, unscorable: true };
  }

  // 3) Sinyal AI-generated lemah: varians kosakata sangat seragam + panjang merata.
  const uniqWords = new Set(words.map((w) => w.toLowerCase())).size;
  const ttr = wordCount > 0 ? uniqWords / wordCount : 0;
  if (wordCount > 80 && ttr > 0.95) {
    anomalies.push({
      type: 'ai_generated',
      confidence: 0.5,
      detail: 'Varians kosakata sangat tinggi (signal lemah teks generator).',
    });
  }

  return { anomalies, unscorable: false };
}