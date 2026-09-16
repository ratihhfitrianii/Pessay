import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClassApi, listClasses, listUsers } from "../lib/api";
import type { ClassItem, UserRow } from "../lib/types";

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [cls, users] = await Promise.all([listClasses(), listUsers()]);
      setClasses(cls);
      setTeachers(users.filter((u) => u.role === "guru"));
    } catch {
      setLoadError("Gagal memuat data kelas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!code.trim() || !name.trim()) {
      setMessage({ type: "err", text: "Kode dan nama kelas wajib diisi." });
      return;
    }
    setSaving(true);
    try {
      await createClassApi({
        code: code.trim(),
        name: name.trim(),
        teacherId: teacherId ? Number(teacherId) : null,
      });
      setMessage({ type: "ok", text: "Kelas berhasil dibuat." });
      setCode("");
      setName("");
      setTeacherId("");
      await load();
    } catch {
      setMessage({ type: "err", text: "Gagal membuat kelas." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Kelas</h1>
      <p className="mt-1 text-slate-500">Kelola kelas dan wali kelas.</p>

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
          Buat kelas baru
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="c-code"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Kode kelas
            </label>
            <input
              id="c-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="XII-IPA-1"
            />
          </div>
          <div>
            <label
              htmlFor="c-name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nama kelas
            </label>
            <input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="Kelas XII IPA 1"
            />
          </div>
          <div>
            <label
              htmlFor="c-teacher"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Wali kelas (guru)
            </label>
            <select
              id="c-teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">— tanpa wali —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
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
          {saving ? "Menyimpan…" : "Buat kelas"}
        </button>
      </form>

      <section className="mt-8" aria-label="Daftar kelas">
        <h2 className="text-lg font-semibold text-slate-800">
          Kelas tersimpan
        </h2>
        {loading && <p className="mt-3 text-sm text-slate-500">Memuat…</p>}
        {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}
        {!loading && !loadError && classes.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">Belum ada kelas.</p>
        )}
        <ul className="mt-3 space-y-2">
          {classes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-800">
                  {c.code} — {c.name}
                </p>
                <p className="text-xs text-slate-500">
                  {c.studentCount ?? 0} siswa
                  {c.teacherName ? ` · wali: ${c.teacherName}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
