jest.mock("ioredis", () => {
  class MockRedis {
    static instances: MockRedis[] = [];
    store: Record<string, string> = {};
    private errorCb: ((err: unknown) => void) | null = null;

    constructor(
      public url: string,
      public opts: Record<string, unknown> = {},
    ) {
      MockRedis.instances.push(this);
      if (typeof opts.retryStrategy === "function") {
        (opts.retryStrategy as (t: number) => number | null)(1);
      }
    }

    on(ev: string, cb: unknown): this {
      if (ev === "error") this.errorCb = cb as (err: unknown) => void;
      return this;
    }

    connect(): Promise<string> {
      return Promise.resolve("OK");
    }

    async get(k: string): Promise<string | null> {
      return this.store[k] ?? null;
    }

    async set(k: string, v: string): Promise<string> {
      this.store[k] = v;
      return "OK";
    }

    async del(...ks: string[]): Promise<number> {
      let n = 0;
      for (const k of ks) {
        if (k in this.store) {
          delete this.store[k];
          n += 1;
        }
      }
      return n;
    }

    async keys(pattern: string): Promise<string[]> {
      const prefix = pattern.replace("*", "");
      return Object.keys(this.store).filter((k) => k.startsWith(prefix));
    }

    emitError(err: unknown): void {
      this.errorCb?.(err);
    }
  }
  return { Redis: MockRedis };
});

// Modul cache tidak boleh di-import statis (env REDIS_URL dibaca saat load).
let cacheGet: (k: string) => Promise<unknown>;
let cacheSet: (k: string, v: unknown, ttl: number) => Promise<void>;
let cacheDel: (k: string) => Promise<void>;
let cacheDelPattern: (p: string) => Promise<void>;

describe("cache dengan Redis aktif", () => {
  beforeAll(async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    jest.resetModules();
    const m = (await import("./cache")) as typeof import("./cache");
    cacheGet = m.cacheGet;
    cacheSet = m.cacheSet;
    cacheDel = m.cacheDel;
    cacheDelPattern = m.cacheDelPattern;
  });

  afterAll(() => {
    process.env.REDIS_URL = "";
    jest.resetModules();
  });

  it("set → get roundtrip dengan JSON parse", async () => {
    await cacheSet("kunci", { a: 1 }, 60);
    const got = await cacheGet("kunci");
    expect(got).toEqual({ a: 1 });
  });

  it("get key tak ada → null", async () => {
    expect(await cacheGet("tidak-ada")).toBeNull();
  });

  it("del menghapus key", async () => {
    await cacheSet("hapus", "x", 60);
    await cacheDel("hapus");
    expect(await cacheGet("hapus")).toBeNull();
  });

  it("delPattern menghapus semua key dengan prefix", async () => {
    await cacheSet("pref:1", "a", 60);
    await cacheSet("pref:2", "b", 60);
    await cacheSet("lain:1", "c", 60);
    await cacheDelPattern("pref:*");
    expect(await cacheGet("pref:1")).toBeNull();
    expect(await cacheGet("pref:2")).toBeNull();
    expect(await cacheGet("lain:1")).toBe("c");
  });

  it("error pada koneksi → redis dinonaktifkan (graceful)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require("ioredis");
    const inst = Redis.instances[Redis.instances.length - 1];
    inst.emitError(new Error("koneksi putus"));
    expect(await cacheGet("kunci")).toBeNull();
  });
});

describe("cache tanpa Redis (REDIS_URL kosong)", () => {
  beforeAll(async () => {
    process.env.REDIS_URL = "";
    jest.resetModules();
    const m = (await import("./cache")) as typeof import("./cache");
    cacheGet = m.cacheGet;
    cacheSet = m.cacheSet;
    cacheDel = m.cacheDel;
    cacheDelPattern = m.cacheDelPattern;
  });

  it("semua operasi no-op tanpa throw", async () => {
    await expect(cacheGet("x")).resolves.toBeNull();
    await expect(cacheSet("x", 1, 10)).resolves.toBeUndefined();
    await expect(cacheDel("x")).resolves.toBeUndefined();
    await expect(cacheDelPattern("x*")).resolves.toBeUndefined();
  });
});
