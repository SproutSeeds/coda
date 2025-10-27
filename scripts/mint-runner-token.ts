/**
 * Mint a long-lived runner token (HS256) compatible with the Relay.
 * Usage:
 *   DEVMODE_JWT_SECRET=... pnpm ts-node --esm scripts/mint-runner-token.ts <runnerId> <userId>
 */
import { mintRunnerToken } from "@/lib/devmode/session";

async function main() {
  const [runnerId, userId] = process.argv.slice(2);
  if (!runnerId || !userId) {
    console.error("Usage: pnpm ts-node --esm scripts/mint-runner-token.ts <runnerId> <userId>");
    process.exit(1);
  }
  const token = await mintRunnerToken({ runnerId, userId });
  console.log(token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

