import { GeminiGradingAdapter, createGradingAdapter } from "./gemini.js";
import { MockGradingAdapter } from "./mock.js";

describe("gemini adapter", () => {
  it("createGradingAdapter mode mock → MockGradingAdapter", () => {
    const a = createGradingAdapter("mock", "", "gemini-2.0-flash");
    expect(a).toBeInstanceOf(MockGradingAdapter);
    expect(a.mode).toBe("mock");
  });

  it("createGradingAdapter mode real tanpa key → throw CONFIG_ERROR", () => {
    expect(() => createGradingAdapter("real", "", "gemini-2.0-flash")).toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it("createGradingAdapter mode real dengan key → GeminiGradingAdapter", () => {
    const a = createGradingAdapter("real", "test-key", "gemini-2.0-flash");
    expect(a).toBeInstanceOf(GeminiGradingAdapter);
    expect(a.mode).toBe("real");
  });

  it("grade gagal jika API tidak ok → AI_PROVIDER_ERROR", async () => {
    const adapter = new GeminiGradingAdapter("dummy", "gemini-2.0-flash");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    }) as unknown as typeof fetch;
    await expect(
      adapter.grade({
        submissionId: 1,
        body: "tes",
        subject: "bahasa",
        language: "id",
        instructions: "soal",
        rubric: [],
        maxScore: 100,
      }),
    ).rejects.toThrow(/Gemini API gagal/);
  });

  it("grade mem-parsing hasil JSON valid", async () => {
    const adapter = new GeminiGradingAdapter("dummy", "gemini-2.0-flash");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallScore: 85,
                    dimensions: [
                      { name: "Isi", score: 40, max: 40, comment: "bagus" },
                    ],
                    feedback: ["Saran"],
                    strengths: ["Kuat"],
                    improvements: ["Perbaiki"],
                    confidence: 0.8,
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;
    const r = await adapter.grade({
      submissionId: 1,
      body: "esai",
      subject: "bahasa",
      language: "id",
      instructions: "soal",
      rubric: [{ name: "Isi", max: 40, description: "x" }],
      maxScore: 100,
    });
    expect(r.subject).toBe("bahasa");
    expect(r.overallScore).toBe(85);
    expect(r.dimensions[0]?.name).toBe("Isi");
  });

  it("grade mengembalikan mathCorrect untuk matematika", async () => {
    const adapter = new GeminiGradingAdapter("dummy", "gemini-2.0-flash");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    overallScore: 90,
                    dimensions: [],
                    feedback: [],
                    strengths: [],
                    improvements: [],
                    confidence: 0.9,
                    mathCorrect: true,
                    correctAnswer: "x = 6",
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;
    const r = await adapter.grade({
      submissionId: 2,
      body: "x = 6",
      subject: "matematika",
      language: "id",
      instructions: "soal",
      rubric: [],
      maxScore: 100,
    });
    if (r.subject === "matematika") {
      expect(r.mathCorrect).toBe(true);
      expect(r.correctAnswer).toBe("x = 6");
    } else {
      throw new Error("harus matematika");
    }
  });

  it("grade tanpa candidates → AI_PROVIDER_ERROR", async () => {
    const adapter = new GeminiGradingAdapter("dummy", "gemini-2.0-flash");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    }) as unknown as typeof fetch;
    await expect(
      adapter.grade({
        submissionId: 1,
        body: "tes",
        subject: "bahasa",
        language: "id",
        instructions: "soal",
        rubric: [],
        maxScore: 100,
      }),
    ).rejects.toThrow(/tidak mengembalikan konten/);
  });
});
