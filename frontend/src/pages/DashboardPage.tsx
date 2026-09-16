import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-500">
        Selamat datang, {user?.fullName}. Anda masuk sebagai{" "}
        <span className="capitalize">{user?.role}</span>.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">Peran Anda</h2>
          <p className="mt-1 text-lg font-bold text-slate-800 capitalize">
            {user?.role}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">
            Mode penilaian
          </h2>
          <p className="mt-1 text-lg font-bold text-slate-800">
            AI (Gemini Flash)
          </p>
          <p className="text-xs text-slate-500">multi-bahasa + matematika</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">Kapasitas</h2>
          <p className="mt-1 text-lg font-bold text-slate-800">
            2.000+ peserta
          </p>
          <p className="text-xs text-slate-500">
            batch grading dalam hitungan menit
          </p>
        </div>
      </div>
    </div>
  );
}
