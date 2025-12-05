import "dotenv/config";
// Ensure NODE_ENV defaults to "test" when running Vitest/Playwright locally.
if (!process.env.NODE_ENV) {
  Reflect.set(process.env, "NODE_ENV", "test");
}

// Placeholder for future database setup/teardown hooks (seed/reset between tests).
