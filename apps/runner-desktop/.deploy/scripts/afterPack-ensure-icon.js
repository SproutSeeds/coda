const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

module.exports = async function afterPackEnsureIcon(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  await ensureNodePtyUnpacked(context);

  const appOutDir = context.appOutDir;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const resourcesDir = path.join(appPath, "Contents", "Resources");
  const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
  const iconFileName = "icon.icns";
  const sourceIconPath = path.resolve(__dirname, "..", "build", "coda-icon.icns");
  const destinationIconPath = path.join(resourcesDir, iconFileName);

  await fs.promises.mkdir(resourcesDir, { recursive: true });

  const sourceIconBuffer = fs.readFileSync(sourceIconPath);
  let shouldCopyIcon = true;

  if (fs.existsSync(destinationIconPath)) {
    const existingIconBuffer = fs.readFileSync(destinationIconPath);
    shouldCopyIcon = !existingIconBuffer.equals(sourceIconBuffer);
  }

  if (shouldCopyIcon) {
    fs.writeFileSync(destinationIconPath, sourceIconBuffer);
  }

  const infoAsJson = execFileSync(
    "plutil",
    ["-convert", "json", "-o", "-", infoPlistPath],
    { encoding: "utf8" },
  );

  const info = JSON.parse(infoAsJson);
  info.CFBundleIconFile = iconFileName;
  info.CFBundleIcons = info.CFBundleIcons || {};
  info.CFBundleIcons.CFBundlePrimaryIcon = info.CFBundleIcons.CFBundlePrimaryIcon || {};
  info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconFiles = ["icon"];
  info.CFBundleIcons.CFBundlePrimaryIcon.CFBundleIconName = "AppIcon";

  const tmpJsonPath = `${infoPlistPath}.codex-icon.json`;
  fs.writeFileSync(tmpJsonPath, JSON.stringify(info, null, 2));

  execFileSync("plutil", ["-convert", "xml1", "-o", infoPlistPath, tmpJsonPath]);
  fs.unlinkSync(tmpJsonPath);

  console.log("[afterPack] Ensured CFBundleIcon configuration and embedded icon.icns");
};

async function ensureNodePtyUnpacked(context) {
  const appDir = context.appDir || context.packager?.projectDir;
  const appOutDir = context.appOutDir;
  const appInfo = context.packager?.appInfo;
  const appName = appInfo?.productFilename || appInfo?.productName;

  if (!appDir || !appOutDir || !appName) {
    console.warn(
      "[afterPack] Skipping node-pty unpack because packaging context is incomplete",
    );
    console.warn(
      `[afterPack] Debug context values: appDir=${appDir ?? "undefined"}, appOutDir=${appOutDir ?? "undefined"}, appName=${appName ?? "undefined"}`,
    );
    return;
  }

  const resourcesDir = path.join(appOutDir, `${appName}.app`, "Contents", "Resources");
  const unpackedBase = path.join(resourcesDir, "app.asar.unpacked", "node_modules", "node-pty", "build");
  const sourceBase = path.join(appDir, "node_modules", "node-pty", "build");

  await fs.promises.mkdir(resourcesDir, { recursive: true });

  if (!fs.existsSync(sourceBase)) {
    console.warn("[afterPack] node-pty build directory not found; skipping unpack");
    return;
  }

  const variants = ["Release", "Debug"];
  let copied = false;

  for (const variant of variants) {
    const sourceFile = path.join(sourceBase, variant, "pty.node");
    if (!fs.existsSync(sourceFile)) {
      continue;
    }

    const destDir = path.join(unpackedBase, variant);
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.copyFile(sourceFile, path.join(destDir, "pty.node"));
    copied = true;
  }

  if (copied) {
    console.log("[afterPack] Ensured node-pty binaries are available from app.asar.unpacked");
  } else {
    console.warn("[afterPack] node-pty binary was not found; terminal sync will fail until node-pty is rebuilt");
  }
}
