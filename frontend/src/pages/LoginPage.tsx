import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ApiError, NetworkError } from "../lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Isi email dan kata sandi.");
      return;
    }
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      navigate("/");
    } catch (err) {
      if (err instanceof NetworkError) setError(err.message);
      else if (err instanceof ApiError) setError(err.message);
      else setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-2xl font-bold text-white">
            P
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Pessay</h1>
          <p className="mt-1 text-sm text-slate-500">
            Penilaian Esai Otomatis multi-bahasa & matematika
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="identifier"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="nama@sekolah.ac.id"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-600">Akun demo:</p>
          <p>
            admin@pessay.test / admin123 · guru@pessay.test / guru123 ·
            siswa@pessay.test / siswa123
          </p>
        </div>
      </div>
    </div>
  );
}
