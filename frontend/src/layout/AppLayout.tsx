import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../lib/types";

const MENU: { to: string; label: string; roles: Role[] }[] = [
  { to: "/", label: "Dashboard", roles: ["admin", "guru", "siswa"] },
  { to: "/soal", label: "Bank Soal", roles: ["guru", "admin"] },
  { to: "/ujian", label: "Ujian", roles: ["guru", "admin", "siswa"] },
  { to: "/kelas", label: "Kelas", roles: ["admin"] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate("/login");
  }

  const menu = MENU.filter((m) => user && m.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-16 flex-col items-center gap-2 border-r border-slate-200 bg-white py-4 md:flex">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 font-bold text-white">
          P
        </div>
        {menu.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            aria-label={m.label}
            end={m.to === "/"}
            className={({ isActive }) =>
              `group relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isActive
                  ? "bg-primary-100 text-primary-700"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              }`
            }
          >
            <span className="text-sm font-bold">{m.label[0]}</span>
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
              {m.label}
            </span>
          </NavLink>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800">Pessay</span>
            <nav className="ml-4 flex gap-1 md:hidden">
              {menu.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  end={m.to === "/"}
                  className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {m.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:block">
              {user?.fullName} ·{" "}
              <span className="capitalize">{user?.role}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
