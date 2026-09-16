import { AppError, assert, asyncHandler, parseOrThrow } from "./errors.js";
import { z } from "zod";
import type { Request, Response } from "express";

describe("errors helpers", () => {
  it("AppError membawa status/code/details", () => {
    const e = new AppError("X", "pesan", 418, { a: 1 });
    expect(e.status).toBe(418);
    expect(e.code).toBe("X");
    expect(e.details).toEqual({ a: 1 });
    expect(e.message).toBe("pesan");
  });

  it("assert true → ok; false → throw", () => {
    expect(() => assert(true, "X", "m")).not.toThrow();
    expect(() => assert(false, "X", "m", 403)).toThrow(AppError);
  });

  it("parseOrThrow valid → data; invalid → AppError 400 with issues", () => {
    const schema = z.object({ a: z.number() });
    expect(parseOrThrow(schema, { a: 1 })).toEqual({ a: 1 });
    try {
      parseOrThrow(schema, { a: "x" });
      throw new Error("harusnya throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(400);
      expect((e as AppError).code).toBe("VALIDATION_ERROR");
      expect((e as AppError).details).toEqual([
        { path: "a", message: expect.any(String) },
      ]);
    }
  });

  it("asyncHandler meneruskan rejection ke next", async () => {
    const h = asyncHandler(async () => {
      throw new AppError("X", "m", 400);
    });
    const next = jest.fn();
    await h({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it("asyncHandler sukses tidak memanggil next", async () => {
    const h = asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    });
    const next = jest.fn();
    const json = jest.fn();
    await h({} as Request, { json } as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ ok: true });
  });
});
