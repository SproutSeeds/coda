import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import sharp from "sharp";
import png2icons from "png2icons";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const svgSource = path.join(projectRoot, "public", "app-icon.svg");
const outputDir = path.join(projectRoot, "apps", "runner-desktop", "build");
const iconsetDir = path.join(outputDir, "coda-icon.iconset");

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function cleanIconset() {
  if (fs.existsSync(iconsetDir)) {
    await fs.promises.rm(iconsetDir, { recursive: true });
  }
  await ensureDir(iconsetDir);
}

// Generate all required icon sizes for macOS ICNS
async function generateIconsetPngs() {
  const sizes = [
    { size: 16, name: "icon_16x16.png" },
    { size: 32, name: "icon_16x16@2x.png" },
    { size: 32, name: "icon_32x32.png" },
    { size: 64, name: "icon_32x32@2x.png" },
    { size: 128, name: "icon_128x128.png" },
    { size: 256, name: "icon_128x128@2x.png" },
    { size: 256, name: "icon_256x256.png" },
    { size: 512, name: "icon_256x256@2x.png" },
    { size: 512, name: "icon_512x512.png" },
    { size: 1024, name: "icon_512x512@2x.png" },
  ];

  for (const { size, name } of sizes) {
    const outputPath = path.join(iconsetDir, name);
    await sharp(svgSource)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
  }

  console.log(`Generated ${sizes.length} PNG sizes in iconset`);
}

// Generate standalone PNGs for other uses
async function generateStandalonePngs() {
  const base1024 = path.join(outputDir, "coda-icon-1024.png");
  const base512 = path.join(outputDir, "coda-icon-512.png");

  await sharp(svgSource)
    .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ compressionLevel: 0 })
    .toFile(base1024);

  await sharp(svgSource)
    .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ compressionLevel: 6 })
    .toFile(base512);

  return { base1024, base512 };
}

function generateIcnsFromIconset() {
  const icnsPath = path.join(outputDir, "coda-icon.icns");

  try {
    // Use macOS native iconutil to generate proper ICNS
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, {
      stdio: 'inherit'
    });
    console.log("Generated ICNS using iconutil");

    // Verify the file was created and has reasonable size
    const stats = fs.statSync(icnsPath);
    if (stats.size < 10000) {
      throw new Error(`Generated ICNS is too small (${stats.size} bytes), expected >10KB`);
    }
    console.log(`ICNS file size: ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error("Failed to generate ICNS with iconutil:", error.message);
    throw error;
  }
}

function generateIcoFromPng(pngPath) {
  const pngBuffer = fs.readFileSync(pngPath);
  const ico = png2icons.createICO(pngBuffer, png2icons.BICUBIC, true, 0);

  if (!ico) {
    throw new Error("Failed to generate .ico from PNG");
  }

  fs.writeFileSync(path.join(outputDir, "coda-icon.ico"), ico);
  console.log("Generated ICO for Windows");
}

async function main() {
  await ensureDir(outputDir);
  await cleanIconset();

  // Generate all PNG sizes in iconset format
  await generateIconsetPngs();

  // Generate ICNS from iconset using macOS native tool
  generateIcnsFromIconset();

  // Generate standalone PNGs for other uses
  const { base1024 } = await generateStandalonePngs();

  // Generate ICO for Windows
  generateIcoFromPng(base1024);

  // Clean up iconset directory
  await fs.promises.rm(iconsetDir, { recursive: true });

  console.log("✓ Runner desktop icons generated in:", outputDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
