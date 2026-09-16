import { AppError } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

function makeRes(): Response {
  return { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
}

function makeReq(auth?: string, user?: { id: number; role: string }): Request {
  const req = { headers: {}, user } as unknown as Request;
  if (auth) req.headers = { authorization: auth };
  return req;
}

describe('requireAuth branches', () => {
  it('tanpa header authorization → 401 UNAUTHORIZED', () => {
    const next = jest.fn() as NextFunction;
    requireAuth(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, code: 'UNAUTHORIZED' }));
  });

  it('header bukan Bearer → 401', () => {
    const next = jest.fn() as NextFunction;
    requireAuth(makeReq('Basic abc'), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('token valid → req.user diisi, next() tanpa error', () => {
    const token = jwt.sign({ id: 7, role: 'siswa' }, process.env.JWT_SECRET ?? 'x');
    const next = jest.fn() as NextFunction;
    const req = makeReq(`Bearer ${token}`);
    requireAuth(req, makeRes(), next);
    expect(req.user).toEqual({ id: 7, role: 'siswa' });
    expect(next).toHaveBeenCalledWith();
  });

  it('token invalid → 401', () => {
    const next = jest.fn() as NextFunction;
    requireAuth(makeReq('Bearer token-salah'), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });
});

describe('requireRole branches', () => {
  it('req.user tidak ada → 401', () => {
    const next = jest.fn() as NextFunction;
    requireRole('guru')(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, code: 'UNAUTHORIZED' }));
  });

  it('role tidak cocok → 403 FORBIDDEN', () => {
    const next = jest.fn() as NextFunction;
    requireRole('guru')(makeReq(undefined, { id: 1, role: 'siswa' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: 'FORBIDDEN' }));
  });

  it('role cocok → next() tanpa error', () => {
    const next = jest.fn() as NextFunction;
    requireRole('guru', 'admin')(makeReq(undefined, { id: 1, role: 'admin' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('AppError import berfungsi (guard)', () => {
    expect(new AppError('X', 'm').code).toBe('X');
  });
});