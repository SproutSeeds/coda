const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

module.exports = async function afterPackEnsureIcon(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

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
