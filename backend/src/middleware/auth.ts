import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const SECRET = process.env.JWT_SECRET ?? 'pessay-dev-secret-change-me-123456';

export interface AuthUser {
  id: number;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError('UNAUTHORIZED', 'Token tidak ditemukan', 401));
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    req.user = { id: Number(payload.id ?? payload.sub), role: String(payload.role ?? '') };
    next();
  } catch {
    next(new AppError('UNAUTHORIZED', 'Token tidak valid atau kedaluwarsa', 401));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('UNAUTHORIZED', 'Belum login', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 'Anda tidak memiliki akses ke sumber daya ini', 403));
      return;
    }
    next();
  };
}