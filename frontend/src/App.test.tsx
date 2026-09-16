import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { vi } from "vitest";

vi.mock("./lib/api", () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  setToken: vi.fn(),
  ApiError: class ApiError extends Error {},
  NetworkError: class NetworkError extends Error {},
}));

const api = await import("./lib/api");

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("App routing + guard", () => {
  it("tanpa token → redirect ke /login", async () => {
    localStorage.clear();
    renderApp(["/"]);
    expect(await screen.findByText("Pessay")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("dengan token guru → dashboard tampil", async () => {
    localStorage.setItem("pessay.token", "t");
    vi.mocked(api.getMe).mockResolvedValue({
      id: 2,
      email: "g@p.test",
      fullName: "Guru",
      role: "guru",
    });
    renderApp(["/"]);
    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });
});
