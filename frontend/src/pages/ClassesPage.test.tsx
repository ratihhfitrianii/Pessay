import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import { ClassesPage } from "./ClassesPage";
import { vi } from "vitest";
import type { AuthUser } from "../lib/types";

vi.mock("../lib/api", () => ({
  listClasses: vi.fn(),
  listUsers: vi.fn(),
  createClassApi: vi.fn(),
  getMe: vi.fn(),
}));

const api = await import("../lib/api");

const ADMIN: AuthUser = {
  id: 1,
  email: "a@p.test",
  fullName: "Admin",
  role: "admin",
};

function renderPage() {
  localStorage.setItem("pessay.token", "t");
  vi.mocked(api.getMe).mockResolvedValue(ADMIN);
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ClassesPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listClasses).mockResolvedValue([
    {
      id: 1,
      code: "XII-A",
      name: "Kelas XII A",
      studentCount: 30,
      teacherName: "Bu Rina",
    },
  ]);
  vi.mocked(api.listUsers).mockResolvedValue([
    {
      id: 1,
      email: "a@p.test",
      fullName: "Admin",
      role: "admin",
      isActive: true,
    },
    {
      id: 2,
      email: "g@p.test",
      fullName: "Bu Rina",
      role: "guru",
      isActive: true,
    },
  ]);
});

describe("ClassesPage", () => {
  it("menampilkan daftar kelas + dropdown guru", async () => {
    renderPage();
    expect(await screen.findByText("XII-A — Kelas XII A")).toBeInTheDocument();
    expect(screen.getByText("30 siswa · wali: Bu Rina")).toBeInTheDocument();
    const select = screen.getByLabelText(
      "Wali kelas (guru)",
    ) as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThanOrEqual(2);
  });

  it("submit validasi kosong → alert", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Buat kelas" }));
    expect(
      await screen.findByText("Kode dan nama kelas wajib diisi."),
    ).toBeInTheDocument();
    expect(api.createClassApi).not.toHaveBeenCalled();
  });

  it("buat kelas sukses → panggil createClassApi + reload", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createClassApi).mockResolvedValue({ id: 9 });
    renderPage();
    await user.type(await screen.findByLabelText("Kode kelas"), "XII-B");
    await user.type(screen.getByLabelText("Nama kelas"), "Kelas XII B");
    const select = screen.getByLabelText(
      "Wali kelas (guru)",
    ) as HTMLSelectElement;
    await user.selectOptions(select, "2");
    await user.click(screen.getByRole("button", { name: "Buat kelas" }));
    expect(api.createClassApi).toHaveBeenCalledWith({
      code: "XII-B",
      name: "Kelas XII B",
      teacherId: 2,
    });
    expect(
      await screen.findByText("Kelas berhasil dibuat."),
    ).toBeInTheDocument();
  });

  it("gagal memuat → alert", async () => {
    vi.mocked(api.listClasses).mockRejectedValue(new Error("x"));
    renderPage();
    expect(
      await screen.findByText("Gagal memuat data kelas."),
    ).toBeInTheDocument();
  });
});
