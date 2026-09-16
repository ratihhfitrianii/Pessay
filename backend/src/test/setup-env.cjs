// Test env: DB test terpisah, mode mock grading, tanpa redis.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/pessay_test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "pessay-test-secret-0123456789abcdef";
process.env.REDIS_URL = "";
process.env.GRADING_MODE = "mock";
