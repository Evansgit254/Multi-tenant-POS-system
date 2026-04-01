// Forces Prisma to use test.db instead of dev.db for all test runs
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
