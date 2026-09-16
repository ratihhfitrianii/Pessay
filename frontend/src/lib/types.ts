export type Role = "admin" | "guru" | "siswa";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Prompt {
  id: number;
  title: string;
  subject: "bahasa" | "matematika";
  language: string;
  instructions: string;
  rubric: RubricDimension[];
  maxScore: number;
  createdAt?: string;
  teacherName?: string | null;
}

export interface RubricDimension {
  name: string;
  max: number;
  description?: string;
}

export interface ClassItem {
  id: number;
  code: string;
  name: string;
  teacherName?: string | null;
  studentCount?: number;
}

export interface Assignment {
  id: number;
  title: string;
  promptId: number;
  classId: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  prompt?: Prompt;
  submissionCount?: number;
}

export interface SubmissionResult {
  id: number;
  status: "pending" | "processing" | "graded" | "needs_review" | "unscorable";
  score: number | null;
  feedback: {
    feedback: string[];
    strengths: string[];
    improvements: string[];
    confidence: number;
    mathCorrect?: boolean;
    correctAnswer?: string;
  } | null;
  anomalies: { type: string; confidence: number; detail: string }[];
  submittedAt?: string;
  gradedAt?: string | null;
}

export interface UserRow {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
}
