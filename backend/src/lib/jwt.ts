import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'pessay-dev-secret-change-me-123456';

export interface JwtUser {
  id: number;
  role: string;
}

export function signToken(user: JwtUser): string {
  return jwt.sign({ id: user.id, role: user.role, sub: String(user.id) }, SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '8h',
  });
}

export function verifyToken(token: string): JwtUser {
  const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
  return { id: Number(payload.id ?? payload.sub), role: String(payload.role ?? '') };
}