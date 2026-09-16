import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import { AssignmentsPage } from "./AssignmentsPage";
import { vi } from "vitest";
import type { Assignment, AuthUser, Prompt } from "../lib/types";

vi.mock("../lib/api", () => ({
  listAssignments: vi.fn(),
  listAvailableAssignments: vi.fn(),
  listPrompts: vi.fn(),
  listClasses: vi.fn(),
  createAssignment: vi.fn(),
  toggleAssignment: vi.fn(),
  getMe: vi.fn(),
}));

const api = await import("../lib/api");

const GURU: AuthUser = {
  id: 2,
  email: "g@p.test",
  fullName: "Guru",
  role: "guru",
};
const SISWA: AuthUser = {
  id: 3,
  email: "s@p.test",
  fullName: "Siswa",
  role: "siswa",
};

const PROMPT: Prompt = {
  id: 1,
  title: "Soal Esai",
  subject: "bahasa",
  language: "id",
  instructions: "Jelaskan pendapat Anda tentang literasi.",
  rubric: [],
  maxScore: 100,
};

const ASG: Assignment = {
  id: 10,
  title: "UTS",
  promptId: 1,
  classId: 2,
  isActive: true,
  prompt: PROMPT,
  submissionCount: 3,
};

function renderPage(user: AuthUser) {
  localStorage.setItem("pessay.token", "t");
  vi.mocked(api.getMe).mockResolvedValue(user);
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AssignmentsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listAssignments).mockResolvedValue([ASG]);
  vi.mocked(api.listAvailableAssignments).mockResolvedValue([ASG]);
  vi.mocked(api.listPrompts).mockResolvedValue([PROMPT]);
  vi.mocked(api.listClasses).mockResolvedValue([
    { id: 2, code: "XII-A", name: "Kelas A" },
  ]);
});

describe("AssignmentsPage (guru)", () => {
  it("menampilkan daftar ujian + form", async () => {
    renderPage(GURU);
    expect(await screen.findByText("UTS")).toBeInTheDocument();
    expect(screen.getByText("Soal Esai · 3 kiriman")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Buat ujian" }),
    ).toBeInTheDocument();
  });

  it("submit tanpa pilihan → alert validasi", async () => {
    const user = userEvent.setup();
    renderPage(GURU);
    await user.click(await screen.findByRole("button", { name: "Buat ujian" }));
    expect(
      await screen.findByText("Judul, soal, dan kelas wajib dipilih."),
    ).toBeInTheDocument();
  });

  it("toggle status aktif → panggil toggleAssignment", async () => {
    const user = userEvent.setup();
    vi.mocked(api.toggleAssignment).mockResolvedValue({
      id: 10,
      isActive: false,
    });
    renderPage(GURU);
    await user.click(await screen.findByRole("button", { name: "Aktif" }));
    expect(api.toggleAssignment).toHaveBeenCalledWith(10, false);
  });

  it("buat ujian sukses → panggil createAssignment", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createAssignment).mockResolvedValue({ id: 11 });
    renderPage(GURU);
    await user.type(await screen.findByLabelText("Judul ujian"), "UTS Genap");
    await user.selectOptions(
      screen.getByLabelText("Soal (dari bank soal)"),
      "1",
    );
    await user.selectOptions(screen.getByLabelText("Kelas"), "2");
    await user.click(screen.getByRole("button", { name: "Buat ujian" }));
    expect(api.createAssignment).toHaveBeenCalledWith({
      promptId: 1,
      classId: 2,
      title: "UTS Genap",
    });
    expect(
      await screen.findByText("Ujian berhasil dibuat."),
    ).toBeInTheDocument();
  });

  it("guru tanpa daftar → pesan kosong", async () => {
    vi.mocked(api.listAssignments).mockResolvedValue([]);
    renderPage(GURU);
    expect(await screen.findByText("Belum ada ujian.")).toBeInTheDocument();
  });
});

describe("AssignmentsPage (siswa)", () => {
  it("menampilkan ujian tersedia + link kerjakan", async () => {
    renderPage(SISWA);
    expect(await screen.findByText("UTS")).toBeInTheDocument();
    expect(
      screen.getByText(/Jelaskan pendapat Anda tentang literasi/),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Kerjakan" });
    expect(link).toHaveAttribute("href", "/kerjakan/10");
  });

  it("siswa tanpa ujian → pesan kosong", async () => {
    vi.mocked(api.listAvailableAssignments).mockResolvedValue([]);
    renderPage(SISWA);
    expect(
      await screen.findByText("Belum ada ujian untuk Anda."),
    ).toBeInTheDocument();
  });
});
