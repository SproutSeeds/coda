/**
 * Quick demo: create a job via API, then send a few log lines to the ingest endpoint.
 * Usage: ts-node scripts/devmode-ingest-example.ts <ideaId>
 */
import http from "node:http";

async function main() {
  const ideaId = process.argv[2];
  if (!ideaId) {
    console.error("Usage: pnpm ts-node scripts/devmode-ingest-example.ts <ideaId>");
    process.exit(1);
  }
  const idem = crypto.randomUUID();
  const res = await fetch("http://localhost:3000/api/devmode/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
    body: JSON.stringify({ ideaId, intent: "live-session", idempotencyKey: idem }),
  });
  if (!res.ok) {
    console.error("Failed to create job:", await res.text());
    process.exit(1);
  }
  const { jobId, wsToken } = (await res.json()) as { jobId: string; wsToken: string };
  console.log("Job:", jobId);

  const send = async (line: string, level: "info" | "warn" | "error" = "info") => {
    await fetch(`http://localhost:3000/api/devmode/logs/ingest?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(wsToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: [{ level, line }] }),
      },
    );
  };

  await send("Runner starting...");
  await new Promise((r) => setTimeout(r, 500));
  await send("Cloning repo...");
  await new Promise((r) => setTimeout(r, 500));
  await send("Installing deps...");
  await new Promise((r) => setTimeout(r, 500));
  await send("Done!", "warn");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

