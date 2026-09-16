import { MockGradingAdapter } from './mock';
import type { GradingInput } from './types';

const adapter = new MockGradingAdapter();

function input(partial: Partial<GradingInput>): GradingInput {
  return {
    submissionId: 1,
    body: 'Ini adalah teks contoh yang cukup panjang untuk menguji adapter mock dengan berbagai dimensi rubrik dan kosakata yang bervariasi.',
    subject: 'bahasa',
    language: 'id',
    instructions: 'Jelaskan.',
    rubric: [],
    maxScore: 100,
    ...partial,
  };
}

describe('MockGradingAdapter branches', () => {
  it('subject matematika → mathCorrect true jika ada "="', async () => {
    const r = await adapter.grade(input({ subject: 'matematika', body: '2x + 3 = 7 maka x = 2' }));
    expect(r.subject).toBe('matematika');
    if (r.subject === 'matematika') expect(r.mathCorrect).toBe(true);
  });

  it('subject matematika → mathCorrect false tanpa bentuk penyelesaian', async () => {
    const r = await adapter.grade(
      input({
        subject: 'matematika',
        body: 'Saya membaca soalnya dengan teliti lalu mencoba memahami maksudnya dengan baik.',
      }),
    );
    if (r.subject === 'matematika') expect(r.mathCorrect).toBe(false);
  });

  it('rubric diisi → dimensi mengikuti rubric', async () => {
    const r = await adapter.grade(
      input({
        rubric: [
          { name: 'Isi', max: 60, description: 'x' },
          { name: 'Bahasa', max: 40, description: 'y' },
        ],
      }),
    );
    expect(r.dimensions).toHaveLength(2);
    expect(r.dimensions[0]?.name).toBe('Isi');
    expect(r.dimensions[0]?.max).toBe(60);
    expect(r.dimensions[1]?.name).toBe('Bahasa');
  });

  it('rubric kosong → dimensi default Kualitas dengan maxScore', async () => {
    const r = await adapter.grade(input({ rubric: [], maxScore: 50 }));
    expect(r.dimensions).toHaveLength(1);
    expect(r.dimensions[0]?.name).toBe('Kualitas');
    expect(r.dimensions[0]?.max).toBe(50);
  });

  it('body kosong → vocabScore 0, tapi tetap memproduksi hasil', async () => {
    const r = await adapter.grade(input({ body: '   ' }));
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('rubric lebih dari 3 dimensi → base default 0.6 untuk sisanya', async () => {
    const r = await adapter.grade(
      input({
        rubric: [
          { name: 'A', max: 25, description: '' },
          { name: 'B', max: 25, description: '' },
          { name: 'C', max: 25, description: '' },
          { name: 'D', max: 25, description: '' },
        ],
      }),
    );
    expect(r.dimensions).toHaveLength(4);
    expect(r.dimensions[3]?.score).toBeGreaterThan(0);
  });
});