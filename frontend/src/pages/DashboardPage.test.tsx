import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import { DashboardPage } from "./DashboardPage";
import { vi } from "vitest";
import type { AuthUser } from "../lib/types";

vi.mock("../lib/api", () => ({
  getMe: vi.fn(),
}));

const api = await import("../lib/api");

const SISWA: AuthUser = {
  id: 3,
  email: "s@p.test",
  fullName: "Siti",
  role: "siswa",
};

describe("DashboardPage", () => {
  it("menampilkan sapaan + info peran", async () => {
    localStorage.setItem("pessay.token", "t");
    vi.mocked(api.getMe).mockResolvedValue(SISWA);
    render(
      <MemoryRouter>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Selamat datang/)).toBeInTheDocument();
    expect(screen.getByText(/Siti/)).toBeInTheDocument();
    expect(screen.getByText("2.000+ peserta")).toBeInTheDocument();
  });
});
