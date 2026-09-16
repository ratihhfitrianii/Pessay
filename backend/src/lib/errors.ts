import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function assert(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}

/** parseOrThrow — schema tetap STRICT; ZodError dikonversi jadi 400, bukan 500. */
export function parseOrThrow<T>(schema: import('zod').ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Data tidak valid',
      400,
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

/**
 * Express 4 TIDAK menangkap rejected promise dari async handler secara otomatis.
 * Wrapper ini meneruskan rejection ke next(err) sehingga error middleware jalan.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}