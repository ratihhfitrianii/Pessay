import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import { ExamPage } from "./ExamPage";
import { vi } from "vitest";
import type { AuthUser } from "../lib/types";

vi.mock("../lib/api", () => ({
  listAvailableAssignments: vi.fn(),
  getMySubmission: vi.fn(),
  submitAnswer: vi.fn(),
  getMe: vi.fn(),
}));

const api = await import("../lib/api");

const SISWA: AuthUser = {
  id: 3,
  email: "s@p.test",
  fullName: "Siswa",
  role: "siswa",
};

function renderPage(assignmentId = 10) {
  localStorage.setItem("pessay.token", "t");
  vi.mocked(api.getMe).mockResolvedValue(SISWA);
  return render(
    <MemoryRouter initialEntries={[`/kerjakan/${assignmentId}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/kerjakan/:id" element={<ExamPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listAvailableAssignments).mockResolvedValue([
    {
      id: 10,
      title: "UTS Bahasa Indonesia",
      promptId: 1,
      classId: 2,
      isActive: true,
      prompt: {
        id: 1,
        title: "Soal",
        subject: "bahasa",
        language: "id",
        instructions: "Tuliskan pendapat Anda tentang literasi.",
        rubric: [],
        maxScore: 100,
      },
    },
  ]);
  vi.mocked(api.getMySubmission).mockRejectedValue(new Error("belum submit"));
});

describe("ExamPage", () => {
  it("menampilkan soal + form jawaban", async () => {
    renderPage();
    expect(await screen.findByText("UTS Bahasa Indonesia")).toBeInTheDocument();
    expect(
      screen.getByText(/Tuliskan pendapat Anda tentang literasi/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Jawaban Anda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kumpulkan jawaban" }),
    ).toBeInTheDocument();
  });

  it("submit jawaban sukses → status terkirim", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitAnswer).mockResolvedValue({ id: 99 });
    // Awal: belum ada submission → form tampil
    vi.mocked(api.getMySubmission).mockRejectedValue(new Error("belum submit"));
    renderPage();
    await user.type(
      await screen.findByLabelText("Jawaban Anda"),
      "Pendidikan adalah kunci kemajuan bangsa.",
    );
    // Setelah submit: ada submission pending → tampilan hasil
    vi.mocked(api.getMySubmission).mockResolvedValue({
      id: 99,
      status: "pending",
      score: null,
      feedback: null,
      anomalies: [],
    });
    await user.click(screen.getByRole("button", { name: "Kumpulkan jawaban" }));
    expect(api.submitAnswer).toHaveBeenCalledWith(
      10,
      "Pendidikan adalah kunci kemajuan bangsa.",
    );
    expect(await screen.findByText(/Jawaban terkirim/)).toBeInTheDocument();
  });

  it("jawaban terlalu pendek → alert", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Jawaban Anda"), "ya");
    await user.click(screen.getByRole("button", { name: "Kumpulkan jawaban" }));
    expect(
      await screen.findByText("Jawaban terlalu pendek (minimal 5 karakter)."),
    ).toBeInTheDocument();
    expect(api.submitAnswer).not.toHaveBeenCalled();
  });

  it("sudah dinilai → tampilkan skor dan feedback", async () => {
    vi.mocked(api.getMySubmission).mockResolvedValue({
      id: 99,
      status: "graded",
      score: 85,
      feedback: {
        feedback: ["Bagus."],
        strengths: ["Struktur jelas"],
        improvements: ["Perbanyak contoh"],
        confidence: 0.9,
      },
      anomalies: [],
    });
    renderPage();
    expect(await screen.findByText("85")).toBeInTheDocument();
    expect(screen.getByText("Bagus.")).toBeInTheDocument();
    expect(screen.getByText("Struktur jelas")).toBeInTheDocument();
    expect(screen.getByText("Perbanyak contoh")).toBeInTheDocument();
  });

  it("ujian tidak ditemukan → alert", async () => {
    vi.mocked(api.listAvailableAssignments).mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByText(/Ujian tidak ditemukan atau tidak tersedia/),
    ).toBeInTheDocument();
  });
});
