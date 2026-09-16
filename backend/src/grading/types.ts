/** Shared domain types untuk pipeline grading. */

export type SubjectType = "bahasa" | "matematika";

export type SubmissionStatus =
  "pending" | "processing" | "graded" | "needs_review" | "unscorable";

export interface RubricDimension {
  name: string;
  max: number;
  description: string;
}

/** Hasil dari adapter LLM — diskriminan union per subject. */
export type GradingResult =
  | {
      subject: "bahasa";
      overallScore: number;
      dimensions: {
        name: string;
        score: number;
        max: number;
        comment: string;
      }[];
      feedback: string[];
      strengths: string[];
      improvements: string[];
      confidence: number;
    }
  | {
      subject: "matematika";
      overallScore: number;
      dimensions: {
        name: string;
        score: number;
        max: number;
        comment: string;
      }[];
      feedback: string[];
      strengths: string[];
      improvements: string[];
      confidence: number;
      mathCorrect: boolean;
      correctAnswer?: string;
    };

/** Input grading untuk satu submission. */
export interface GradingInput {
  submissionId: number;
  body: string;
  subject: SubjectType;
  language: string;
  instructions: string;
  rubric: RubricDimension[];
  maxScore: number;
}

/** Antarmuka adapter LLM — mock dan real sama-sama mengimplementasi ini. */
export interface GradingAdapter {
  readonly mode: "mock" | "real";
  grade(input: GradingInput): Promise<GradingResult>;
}

export interface Anomaly {
  type: "plagiarism" | "repetition" | "ai_generated" | "unscorable";
  confidence: number;
  detail: string;
}

export interface IntegrityReport {
  anomalies: Anomaly[];
  unscorable: boolean;
}
