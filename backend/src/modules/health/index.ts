import { Router } from "express";
import { pool } from "../../lib/pg";
import { asyncHandler } from "../../lib/errors";

export function createHealthRouter(): Router {
  const router = Router();

  router.get(
    "/health",
    asyncHandler(async (_req, res) => {
      let db = "down";
      try {
        await pool.query("SELECT 1");
        db = "up";
      } catch {
        db = "down";
      }
      res.json({
        success: true,
        data: { status: "ok", db, time: new Date().toISOString() },
      });
    }),
  );

  router.get(
    "/health/ready",
    asyncHandler(async (_req, res) => {
      try {
        await pool.query("SELECT 1");
        res.json({ success: true, data: { status: "ready" } });
      } catch {
        res.status(503).json({
          success: false,
          error: { code: "DB_DOWN", message: "Database tidak tersedia" },
        });
      }
    }),
  );

  return router;
}
