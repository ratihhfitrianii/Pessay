import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import { AppLayout } from "./AppLayout";
import { vi } from "vitest";
import type { AuthUser } from "../lib/types";

vi.mock("../lib/api", () => ({
  getMe: vi.fn(),
}));

const api = await import("../lib/api");

const GURU: AuthUser = {
  id: 2,
  email: "g@p.test",
  fullName: "Bu Rina",
  role: "guru",
};

function renderLayout(role: AuthUser["role"] = "guru") {
  localStorage.setItem("pessay.token", "t");
  const user =
    role === "guru"
      ? GURU
      : { id: 3, email: "s@p.test", fullName: "Siti", role: "siswa" as const };
  vi.mocked(api.getMe).mockResolvedValue(user);
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Konten Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>Halaman Login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  it("guru melihat menu Dashboard, Bank Soal, Ujian — bukan Kelas", async () => {
    renderLayout("guru");
    expect(await screen.findByText("Konten Dashboard")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Dashboard" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Bank Soal" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Ujian" }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByRole("link", { name: "Kelas" })).toHaveLength(0);
  });

  it("siswa hanya melihat Dashboard & Ujian", async () => {
    renderLayout("siswa");
    expect(await screen.findByText("Konten Dashboard")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Dashboard" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Ujian" }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByRole("link", { name: "Bank Soal" })).toHaveLength(
      0,
    );
  });

  it("tombol Keluar → logout + redirect ke /login", async () => {
    const user = userEvent.setup();
    renderLayout("guru");
    await screen.findByText("Konten Dashboard");
    await user.click(screen.getByRole("button", { name: "Keluar" }));
    expect(localStorage.getItem("pessay.token")).toBeNull();
    expect(await screen.findByText("Halaman Login")).toBeInTheDocument();
  });
});
