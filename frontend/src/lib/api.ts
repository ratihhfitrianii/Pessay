import type {
  Assignment,
  AuthUser,
  ClassItem,
  LoginResponse,
  Prompt,
  RubricDimension,
  SubmissionResult,
  UserRow,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const TOKEN_KEY = "pessay.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export class NetworkError extends Error {
  constructor() {
    super(
      "Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba lagi.",
    );
    this.name = "NetworkError";
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; fields?: Record<string, string> };
}

function toCamel<T>(obj: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = v;
  }
  return out as T;
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && !path.startsWith("/auth/")) {
    setToken(null);
    window.location.href = "/login";
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Sesi berakhir, silakan masuk kembali.",
    );
  }

  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    const err = json.error ?? { code: "ERROR", message: "Terjadi kesalahan" };
    throw new ApiError(res.status, err.code, err.message, err.fields);
  }
  return json.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, "GET");
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "POST", body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "PATCH", body);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "PUT", body);
}

export async function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, "DELETE");
}

// --- Auth ---
export async function login(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const data = await request<LoginResponse>("/api/v1/auth/login", "POST", {
    identifier,
    password,
  });
  setToken(data.token);
  return data;
}

// --- Me ---
export async function getMe(): Promise<AuthUser> {
  const data = await apiGet<Record<string, unknown>>("/api/v1/auth/me");
  return toCamel<AuthUser>(data);
}

// --- Prompts ---
export async function listPrompts(params?: {
  subject?: string;
  language?: string;
}): Promise<Prompt[]> {
  const q = new URLSearchParams();
  if (params?.subject) q.set("subject", params.subject);
  if (params?.language) q.set("language", params.language);
  const data = await apiGet<Record<string, unknown>[]>(
    `/api/v1/prompts${q.size ? `?${q}` : ""}`,
  );
  return data.map((r) => toCamel<Prompt>(r));
}

export async function createPrompt(input: {
  title: string;
  subject: "bahasa" | "matematika";
  language: string;
  instructions: string;
  rubric: RubricDimension[];
  maxScore: number;
}): Promise<{ id: number }> {
  return apiPost<{ id: number }>("/api/v1/prompts", input);
}

export async function deletePrompt(id: number): Promise<{ id: number }> {
  return apiDelete<{ id: number }>(`/api/v1/prompts/${id}`);
}

// --- Classes (admin) ---
export async function listClasses(): Promise<ClassItem[]> {
  const data = await apiGet<Record<string, unknown>[]>("/api/v1/admin/classes");
  return data.map((r) => toCamel<ClassItem>(r));
}

// --- Assignments ---
export async function listAssignments(): Promise<Assignment[]> {
  const data = await apiGet<Record<string, unknown>[]>(`/api/v1/assignments`);
  return data.map((r) => {
    const item = toCamel<Assignment>(r);
    if (item.prompt)
      item.prompt = toCamel<Prompt>(
        item.prompt as unknown as Record<string, unknown>,
      );
    return item;
  });
}

export async function listAvailableAssignments(): Promise<Assignment[]> {
  const data = await apiGet<Record<string, unknown>[]>(
    `/api/v1/assignments/available`,
  );
  return data.map((r) => {
    const item = toCamel<Assignment>(r);
    if (item.prompt)
      item.prompt = toCamel<Prompt>(
        item.prompt as unknown as Record<string, unknown>,
      );
    return item;
  });
}

export async function createAssignment(input: {
  promptId: number;
  classId: number;
  title: string;
  startsAt?: string;
  endsAt?: string;
}): Promise<{ id: number }> {
  return apiPost<{ id: number }>("/api/v1/assignments", input);
}

export async function toggleAssignment(
  id: number,
  isActive: boolean,
): Promise<{ id: number; isActive: boolean }> {
  return apiPatch<{ id: number; isActive: boolean }>(
    `/api/v1/assignments/${id}`,
    { isActive },
  );
}

// --- Submissions ---
export async function submitAnswer(
  assignmentId: number,
  body: string,
): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/api/v1/submissions`, { assignmentId, body });
}

export async function getMySubmission(
  assignmentId: number,
): Promise<SubmissionResult> {
  const data = await apiGet<Record<string, unknown>>(
    `/api/v1/submissions/my/${assignmentId}`,
  );
  return toCamel<SubmissionResult>(data);
}

// --- Admin users ---
export async function listUsers(): Promise<UserRow[]> {
  const data = await apiGet<Record<string, unknown>[]>(`/api/v1/admin/users`);
  return data.map((r) => toCamel<UserRow>(r));
}

export async function createClassApi(input: {
  code: string;
  name: string;
  teacherId?: number | null;
}): Promise<{ id: number }> {
  return apiPost<{ id: number }>("/api/v1/admin/classes", input);
}
