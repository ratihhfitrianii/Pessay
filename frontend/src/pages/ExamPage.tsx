import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import {
  getMySubmission,
  listAvailableAssignments,
  submitAnswer,
} from "../lib/api";
import type { SubmissionResult } from "../lib/types";

type ResultState = SubmissionResult | null;

export function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id ?? 0);

  const [assignment, setAssignment] = useState<{
    title: string;
    instructions: string;
    subject: string;
    language: string;
    maxScore: number;
  } | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listAvailableAssignments();
        const found = list.find((a) => a.id === assignmentId);
        if (!found?.prompt) {
          setMessage({
            type: "err",
            text: "Ujian tidak ditemukan atau tidak tersedia.",
          });
          return;
        }
        setAssignment({
          title: found.title,
          instructions: found.prompt.instructions,
          subject: found.prompt.subject,
          language: found.prompt.language,
          maxScore: found.prompt.maxScore,
        });
        try {
          const existing = await getMySubmission(assignmentId);
          setResult(existing);
        } catch {
          setResult(null);
        }
      } catch {
        setMessage({ type: "err", text: "Gagal memuat ujian." });
      } finally {
        setChecking(false);
      }
    })();
  }, [assignmentId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (body.trim().length < 5) {
      setMessage({
        type: "err",
        text: "Jawaban terlalu pendek (minimal 5 karakter).",
      });
      return;
    }
    setSubmitting(true);
    try {
      await submitAnswer(assignmentId, body.trim());
      setMessage({
        type: "ok",
        text: "Jawaban terkirim! Skor akan muncul setelah diproses (beberapa menit).",
      });
      setBody("");
      const r = await getMySubmission(assignmentId);
      setResult(r);
    } catch {
      setMessage({ type: "err", text: "Gagal mengirim jawaban." });
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p className="text-sm text-slate-500">Memuat…</p>;
  }

  const statusLabel: Record<string, string> = {
    pending: "Menunggu diproses",
    processing: "Sedang dinilai",
    graded: "Selesai",
    needs_review: "Perlu tinjauan guru",
    unscorable: "Tidak dapat dinilai",
  };

  return (
    <div className="mx-auto max-w-3xl">
      {message && (
        <p
          role={message.type === "ok" ? "status" : "alert"}
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {assignment && (
        <>
          <h1 className="text-2xl font-bold text-slate-900">
            {assignment.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {assignment.subject} · {assignment.language} · maks{" "}
            {assignment.maxScore}
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="whitespace-pre-wrap text-slate-800">
              {assignment.instructions}
            </p>
          </div>

          {result ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Hasil</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {statusLabel[result.status] ?? result.status}
                </span>
              </div>

              {result.score !== null && (
                <div className="mt-4">
                  <p className="text-sm text-slate-500">Skor</p>
                  <p className="text-3xl font-bold text-primary-700">
                    {result.score}
                    <span className="text-base font-medium text-slate-400">
                      {" "}
                      / {assignment.maxScore}
                    </span>
                  </p>
                </div>
              )}

              {result.feedback && (
                <div className="mt-5 space-y-4 text-sm">
                  <div>
                    <h3 className="font-semibold text-slate-700">
                      Umpan balik
                    </h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                      {result.feedback.feedback.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  {result.feedback.strengths.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-emerald-700">
                        Kelebihan
                      </h3>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                        {result.feedback.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.feedback.improvements.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-amber-700">
                        Perlu perbaikan
                      </h3>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                        {result.feedback.improvements.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {result.anomalies.length > 0 && (
                <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-semibold">Catatan integritas</p>
                  <ul className="mt-1 list-disc pl-5">
                    {result.anomalies.map((a, i) => (
                      <li key={i}>{a.detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"
            >
              <label
                htmlFor="answer"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Jawaban Anda
              </label>
              <textarea
                id="answer"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                placeholder="Tulis jawaban esai Anda di sini…"
              />
              <button
                type="submit"
                disabled={submitting}
                className="mt-4 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
              >
                {submitting ? "Mengirim…" : "Kumpulkan jawaban"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
