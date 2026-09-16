import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import { PromptsPage } from "./PromptsPage";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/api", () => ({
  listPrompts: vi.fn(),
  createPrompt: vi.fn(),
  deletePrompt: vi.fn(),
  getMe: vi.fn(),
}));

const api = await import("../lib/api");

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PromptsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.setItem("pessay.token", "t");
  vi.mocked(api.getMe).mockResolvedValue({
    id: 2,
    email: "g@p.test",
    fullName: "Guru",
    role: "guru",
  });
  vi.mocked(api.listPrompts).mockResolvedValue([]);
});

describe("PromptsPage", () => {
  it("menampilkan daftar soal yang dimuat", async () => {
    vi.mocked(api.listPrompts).mockResolvedValue([
      {
        id: 1,
        title: "UTS Bahasa Indonesia",
        subject: "bahasa",
        language: "id",
        instructions: "Tuliskan pendapat Anda.",
        rubric: [],
        maxScore: 100,
      },
    ]);
    renderPage();
    expect(await screen.findByText("UTS Bahasa Indonesia")).toBeInTheDocument();
  });

  it("gagal memuat → alert", async () => {
    vi.mocked(api.listPrompts).mockRejectedValue(new Error("x"));
    renderPage();
    expect(
      await screen.findByText("Gagal memuat bank soal."),
    ).toBeInTheDocument();
  });

  it("submit validasi → alert", async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = await screen.findByRole("button", { name: "Simpan soal" });
    user.click(btn);
    expect(
      await screen.findByText("Judul dan instruksi wajib diisi."),
    ).toBeInTheDocument();
  });

  it("buat soal sukses → panggil createPrompt + reload", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createPrompt).mockResolvedValue({ id: 5 });
    renderPage();
    await user.type(await screen.findByLabelText("Judul"), "Soal Matematika");
    await user.type(
      screen.getByLabelText("Instruksi / pertanyaan"),
      "Selesaikan: \\(x+1=0\\)",
    );
    await user.click(screen.getByRole("button", { name: "Simpan soal" }));
    expect(api.createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Soal Matematika",
        subject: "bahasa",
        maxScore: 100,
      }),
    );
    expect(
      await screen.findByText("Soal berhasil disimpan."),
    ).toBeInTheDocument();
  });

  it("tambah dimensi rubrik → baris baru muncul", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "+ Tambah dimensi" }));
    const inputs = screen.getAllByPlaceholderText(/Dimensi \d/);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("hapus soal → panggil deletePrompt", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.mocked(api.listPrompts).mockResolvedValue([
      {
        id: 1,
        title: "UTS Bahasa Indonesia",
        subject: "bahasa",
        language: "id",
        instructions: "Tuliskan pendapat Anda.",
        rubric: [],
        maxScore: 100,
      },
    ]);
    vi.mocked(api.deletePrompt).mockResolvedValue({ id: 1 });
    renderPage();
    await screen.findByText("UTS Bahasa Indonesia");
    // Tombol "Hapus" ada dua: hapus dimensi rubrik + hapus soal. Pilih yang di daftar soal.
    const hapusSoal = (
      await screen.findAllByRole("button", { name: "Hapus" })
    ).find((b) =>
      b.closest("li")?.textContent?.includes("UTS Bahasa Indonesia"),
    );
    expect(hapusSoal).toBeDefined();
    await user.click(hapusSoal!);
    expect(api.deletePrompt).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(
        screen.queryByText("UTS Bahasa Indonesia"),
      ).not.toBeInTheDocument(),
    );
  });
});
