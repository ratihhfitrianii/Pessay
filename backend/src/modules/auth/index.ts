import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../../lib/pg';
import { signToken } from '../../lib/jwt';
import { AppError, asyncHandler, parseOrThrow } from '../../lib/errors';

const loginSchema = z.object({
  identifier: z.string().min(3, 'Email atau username minimal 3 karakter'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export function createAuthRouter(): Router {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(loginSchema, req.body);
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active,
                r.code AS role_code, r.name AS role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.email = $1`,
        [body.identifier],
      );
      const user = rows[0] as
        | {
            id: string;
            password_hash: string;
            full_name: string;
            is_active: boolean;
            role_code: string;
            role_name: string;
            email: string;
          }
        | undefined;

      assertUserFound(user, body.password);

      const ok = await bcrypt.compare(body.password, user.password_hash);
      if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Email atau password salah', 401);

      const token = signToken({ id: Number(user.id), role: user.role_code });
      res.json({
        success: true,
        data: {
          token,
          user: {
            id: Number(user.id),
            email: user.email,
            fullName: user.full_name,
            role: user.role_code,
            roleName: user.role_name,
          },
        },
      });
    }),
  );

  return router;
}

function assertUserFound(
  user:
    | {
        id: string;
        password_hash: string;
        full_name: string;
        is_active: boolean;
        role_code: string;
        role_name: string;
        email: string;
      }
    | undefined,
  password: string,
): asserts user is {
  id: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  role_code: string;
  role_name: string;
  email: string;
} {
  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Email atau password salah', 401);
  if (!user.is_active) throw new AppError('ACCOUNT_DISABLED', 'Akun dinonaktifkan', 403);
  void password;
}