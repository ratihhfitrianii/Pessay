import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { AuthProvider } from "../auth/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  login: vi.fn(),
  setToken: vi.fn(),
  getMe: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  NetworkError: class NetworkError extends Error {},
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("menampilkan form login", () => {
    renderPage();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Kata sandi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Masuk" })).toBeInTheDocument();
  });

  it("validasi kosong → alert", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Isi email dan kata sandi.",
    );
    expect(api.login).not.toHaveBeenCalled();
  });

  it("login sukses → panggil api.login dengan identifier+password", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValue({
      token: "t",
      user: { id: 1, email: "a@b.c", fullName: "A", role: "guru" },
    });
    renderPage();
    await user.type(screen.getByLabelText("Email"), "guru@pessay.test");
    await user.type(screen.getByLabelText("Kata sandi"), "guru123");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(
      await screen.findByRole("button", { name: "Masuk" }),
    ).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith("guru@pessay.test", "guru123");
  });

  it("login gagal (ApiError) → alert pesan server", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValue(
      new api.ApiError(401, "INVALID_CREDENTIALS", "Email atau password salah"),
    );
    renderPage();
    await user.type(screen.getByLabelText("Email"), "x@y.z");
    await user.type(screen.getByLabelText("Kata sandi"), "salah");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email atau password salah",
    );
  });
});
