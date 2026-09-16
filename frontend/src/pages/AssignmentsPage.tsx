import { useEffect, useState, type FormEvent } from "react";
import {
  createAssignment,
  listAssignments,
  listAvailableAssignments,
  listClasses,
  listPrompts,
  toggleAssignment,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import type { Assignment, Prompt } from "../lib/types";

export function AssignmentsPage() {
  const { user } = useAuth();
  const isSiswa = user?.role === "siswa";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [classes, setClasses] = useState<
    { id: number; code: string; name: string }[]
  >([]);
  const [promptId, setPromptId] = useState("");
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setAssignments(
        isSiswa ? await listAvailableAssignments() : await listAssignments(),
      );
    } catch {
      setLoadError("Gagal memuat daftar ujian.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    if (!isSiswa) {
      void listPrompts()
        .then(setPrompts)
        .catch(() => setPrompts([]));
      void listClasses()
        .then((c) =>
          setClasses(c.map((x) => ({ id: x.id, code: x.code, name: x.name }))),
        )
        .catch(() => setClasses([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSiswa]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!title.trim() || !promptId || !classId) {
      setMessage({
        type: "err",
        text: "Judul, soal, dan kelas wajib dipilih.",
      });
      return;
    }
    setSaving(true);
    try {
      await createAssignment({
        promptId: Number(promptId),
        classId: Number(classId),
        title: title.trim(),
      });
      setMessage({ type: "ok", text: "Ujian berhasil dibuat." });
      setTitle("");
      setPromptId("");
      setClassId("");
      await load();
    } catch {
      setMessage({ type: "err", text: "Gagal membuat ujian." });
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(a: Assignment) {
    try {
      await toggleAssignment(a.id, !a.isActive);
      await load();
    } catch {
      setMessage({ type: "err", text: "Gagal mengubah status ujian." });
    }
  }

  if (isSiswa) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Ujian Saya</h1>
        <p className="mt-1 text-slate-500">Ujian yang tersedia untuk Anda.</p>
        {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Memuat…</p>
        ) : assignments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Belum ada ujian untuk Anda.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-800">
                      {a.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {a.prompt?.subject} · {a.prompt?.language} · maks{" "}
                      {a.prompt?.maxScore}
                    </p>
                    {a.prompt && (
                      <p className="mt-2 text-sm text-slate-600">
                        {a.prompt.instructions}
                      </p>
                    )}
                  </div>
                  <a
                    href={`/kerjakan/${a.id}`}
                    className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    Kerjakan
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">Ujian</h1>
      <p className="mt-1 text-slate-500">
        Buat dan kelola ujian dari bank soal.
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
        <h2 className="text-lg font-semibold text-slate-800">
          Buat ujian baru
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="a-title"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Judul ujian
            </label>
            <input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="UTS Bahasa Indonesia"
            />
          </div>
          <div>
            <label
              htmlFor="a-prompt"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Soal (dari bank soal)
            </label>
            <select
              id="a-prompt"
              value={promptId}
              onChange={(e) => setPromptId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">— pilih soal —</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="a-class"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Kelas
            </label>
            <select
              id="a-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">— pilih kelas —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Buat ujian"}
        </button>
      </form>

      <section className="mt-8" aria-label="Daftar ujian">
        <h2 className="text-lg font-semibold text-slate-800">
          Ujian tersimpan
        </h2>
        {loading && <p className="mt-3 text-sm text-slate-500">Memuat…</p>}
        {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}
        {!loading && !loadError && assignments.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">Belum ada ujian.</p>
        )}
        <ul className="mt-3 space-y-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.prompt?.title ?? "—"} · {a.submissionCount ?? 0} kiriman
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(a)}
                className={`ml-3 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  a.isActive
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {a.isActive ? "Aktif" : "Nonaktif"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
