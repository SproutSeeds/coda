const fs = require("node:fs");
const path = require("node:path");

const workspaceModules = [
  {
    name: "@coda/runner-core",
    source: resolveWorkspacePath("packages/runner-core"),
  },
];

async function main() {
  const appDir = path.resolve(__dirname, "..");

  for (const mod of workspaceModules) {
    const destPath = path.join(appDir, "node_modules", ...mod.name.split("/"));
    const sourcePath = mod.source;

    const stats = await safeLstat(destPath);
    if (!stats) {
      console.warn(`[workspace-materialize] Skipping ${mod.name}; not installed`);
      continue;
    }

    if (!stats.isSymbolicLink()) {
      console.log(`[workspace-materialize] ${mod.name} already materialized`);
      continue;
    }

    const resolvedSource = await fs.promises.realpath(destPath);
    if (!resolvedSource.startsWith(sourcePath)) {
      console.warn(
        `[workspace-materialize] ${mod.name} symlink points to unexpected location: ${resolvedSource}`,
      );
    }

    console.log(`[workspace-materialize] Copying ${mod.name} into app node_modules…`);
    await fs.promises.rm(destPath, { recursive: true, force: true });
    await copyWorkspaceModule(sourcePath, destPath);
  }
}

async function copyWorkspaceModule(sourceDir, destDir) {
  await fs.promises.cp(sourceDir, destDir, {
    recursive: true,
    dereference: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`),
  });
}

async function safeLstat(target) {
  try {
    return await fs.promises.lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("[workspace-materialize] Failed to materialize workspace dependencies");
  console.error(error);
  process.exitCode = 1;
});

function resolveWorkspacePath(relativePath) {
  let currentDir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.resolve(currentDir, relativePath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    currentDir = path.resolve(currentDir, "..");
  }

  throw new Error(`[workspace-materialize] Unable to resolve path for ${relativePath}`);
}
