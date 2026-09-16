import { useEffect, useState, type FormEvent } from "react";
import { createPrompt, deletePrompt, listPrompts } from "../lib/api";
import type { Prompt, RubricDimension } from "../lib/types";

const EMPTY_DIMENSION: RubricDimension = {
  name: "",
  max: 100,
  description: "",
};

export function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<"bahasa" | "matematika">("bahasa");
  const [language, setLanguage] = useState("id");
  const [instructions, setInstructions] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [rubric, setRubric] = useState<RubricDimension[]>([
    { ...EMPTY_DIMENSION },
  ]);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setPrompts(await listPrompts());
    } catch {
      setLoadError("Gagal memuat bank soal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateRubric(
    i: number,
    field: keyof RubricDimension,
    value: string | number,
  ) {
    setRubric((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!title.trim() || !instructions.trim()) {
      setMessage({ type: "err", text: "Judul dan instruksi wajib diisi." });
      return;
    }
    const validRubric = rubric.filter((d) => d.name.trim());
    setSaving(true);
    try {
      await createPrompt({
        title: title.trim(),
        subject,
        language: language.trim() || "id",
        instructions: instructions.trim(),
        rubric: validRubric,
        maxScore,
      });
      setMessage({ type: "ok", text: "Soal berhasil disimpan." });
      setTitle("");
      setInstructions("");
      setRubric([{ ...EMPTY_DIMENSION }]);
      await load();
    } catch {
      setMessage({ type: "err", text: "Gagal menyimpan soal." });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("Hapus soal ini?")) return;
    try {
      await deletePrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setMessage({ type: "err", text: "Gagal menghapus soal." });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">Bank Soal</h1>
      <p className="mt-1 text-slate-500">
        Buat soal esai untuk berbagai bahasa dan matematika.
      </p>

      {message && (
        <p
          role={message.type === "ok" ? "status" : "alert"}
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-lg font-semibold text-slate-800">Buat soal baru</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Judul
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="Ujian Tengah Semester Bahasa Indonesia"
            />
          </div>
          <div>
            <label
              htmlFor="subject"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Mata pelajaran
            </label>
            <select
              id="subject"
              value={subject}
              onChange={(e) =>
                setSubject(e.target.value as "bahasa" | "matematika")
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="bahasa">Bahasa</option>
              <option value="matematika">Matematika</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="language"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Bahasa (kode)
            </label>
            <input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="id, en, ar, ko, ja"
            />
          </div>
          <div>
            <label
              htmlFor="maxScore"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Skor maksimum
            </label>
            <input
              id="maxScore"
              type="number"
              min={1}
              max={1000}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value) || 100)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="instructions"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Instruksi / pertanyaan
          </label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            placeholder="Tuliskan pendapat Anda tentang pentingnya literasi, sertakan contoh. (LaTeX: \\(x^2 + 1 = 0\\))"
          />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Rubrik penilaian
            </label>
            <button
              type="button"
              onClick={() =>
                setRubric((prev) => [...prev, { ...EMPTY_DIMENSION }])
              }
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              + Tambah dimensi
            </button>
          </div>
          {rubric.map((d, i) => (
            <div
              key={i}
              className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
            >
              <input
                value={d.name}
                onChange={(e) => updateRubric(i, "name", e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                placeholder={`Dimensi ${i + 1} (mis. Isi, Struktur, Bahasa)`}
              />
              <input
                type="number"
                value={d.max}
                onChange={(e) =>
                  updateRubric(i, "max", Number(e.target.value) || 100)
                }
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                placeholder="Maks"
              />
              <button
                type="button"
                onClick={() =>
                  setRubric((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan soal"}
        </button>
      </form>

      <section className="mt-8" aria-label="Daftar soal">
        <h2 className="text-lg font-semibold text-slate-800">Soal tersimpan</h2>
        {loading && <p className="mt-3 text-sm text-slate-500">Memuat…</p>}
        {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}
        {!loading && !loadError && prompts.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Belum ada soal. Buat soal pertama Anda.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {prompts.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{p.title}</p>
                <p className="text-xs text-slate-500">
                  {p.subject} · {p.language} · maks {p.maxScore}
                  {p.teacherName ? ` · oleh ${p.teacherName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                className="ml-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
