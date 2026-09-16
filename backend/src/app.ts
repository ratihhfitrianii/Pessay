import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AppError } from './lib/errors';
import { createAuthRouter } from './modules/auth/index';
import { createSubmissionsRouter } from './modules/submissions/index';
import { createPromptsRouter } from './modules/prompts/index';
import { createAssignmentsRouter } from './modules/assignments/index';
import { createAdminRouter } from './modules/admin/index';
import { createHealthRouter } from './modules/health/index';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/v1/submissions', createSubmissionsRouter());
  app.use('/api/v1/prompts', createPromptsRouter());
  app.use('/api/v1/assignments', createAssignmentsRouter());
  app.use('/api/v1/admin', createAdminRouter());
  app.use('/api/v1', createHealthRouter());

  // 404
  app.use((req, _res, next) => {
    next(new AppError('NOT_FOUND', `Rute tidak ditemukan: ${req.method} ${req.path}`, 404));
  });

  // Error handler terpusat.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details ?? undefined },
      });
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[error]', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal server' },
    });
  });

  return app;
}