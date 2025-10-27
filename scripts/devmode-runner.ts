import { createFileTokenStore, startRunner, type RunnerLogger } from "@coda/runner-core";

const env = process.env;
const baseUrl = env.BASE_URL || "http://localhost:3000";
const runnerId = env.DEV_RUNNER_ID || "";

if (!runnerId) {
  console.error("DEV_RUNNER_ID is required");
  process.exit(1);
}

const codexArgs = (env.CODEX_ARGS || "").split(" ").filter(Boolean);

const logger: RunnerLogger = {
  info(message, context) {
    context ? console.log(message, context) : console.log(message);
  },
  warn(message, context) {
    context ? console.warn(message, context) : console.warn(message);
  },
  error(message, context) {
    context ? console.error(message, context) : console.error(message);
  },
};

function formatTime(date: Date) {
  return date.toLocaleString();
}

async function main() {
  let handle = await startRunner({
    baseUrl,
    runnerId,
    runnerName: env.DEV_RUNNER_NAME,
    runnerToken: env.RUNNER_TOKEN,
    env,
    logger,
    codex: env.CODEX_CMD ? { command: env.CODEX_CMD, args: codexArgs } : undefined,
    tokenStore: createFileTokenStore(),
    enableTTY: env.TTY_DISABLED === "1" ? false : true,
    relay: {
      url: env.RELAY_URL,
      token: env.RUNNER_TOKEN,
    },
    events: {
      onStatusChange(status) {
        logger.info(`status: ${status}`);
      },
      onPairingCode({ code, expiresAt }) {
        logger.info("==== Coda Runner Pairing ====");
        logger.info(`Code: ${code}`);
        logger.info("Open your Coda app → Enable Dev Mode → Enter this code to approve.");
        logger.info(`Expires at: ${formatTime(expiresAt)}`);
      },
      onPairingSuccess({ runnerId: id }) {
        logger.info(`Paired successfully; runner online (${id}).`);
      },
      onError(error) {
        logger.error(`Runner error: ${error.message}`);
      },
    },
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    logger.info(`Received ${signal}; shutting down runner...`);
    try {
      await handle.stop();
    } catch (err) {
      logger.error(`Error while stopping runner: ${(err as Error).message}`);
    } finally {
      process.exit(0);
    }
  };

  ["SIGINT", "SIGTERM", "SIGHUP"].forEach((sig) => {
    process.on(sig as NodeJS.Signals, () => shutdown(sig as NodeJS.Signals));
  });
}

main().catch((err) => {
  logger.error(`Runner crashed: ${(err as Error).message}`);
  process.exit(1);
});
