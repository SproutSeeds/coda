import "dotenv/config";
import { vi } from "vitest";

// Ensure NODE_ENV defaults to "test" when running Vitest/Playwright locally.
if (!process.env.NODE_ENV) {
  Reflect.set(process.env, "NODE_ENV", "test");
}

// Next.js injects a virtual `server-only` module that throws when imported from
// the client. Vitest executes in a neutral node environment, so we stub it out
// to avoid noise while exercising server modules.
vi.mock("server-only", () => ({}));

// Placeholder for future database setup/teardown hooks (seed/reset between tests).
