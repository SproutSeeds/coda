import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import png2icons from "png2icons";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const svgSource = path.join(projectRoot, "public", "app-icon.svg");
const outputDir = path.join(projectRoot, "apps", "runner-desktop", "build");

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function generatePngs() {
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

function generateIcnsAndIco(pngPath) {
  const pngBuffer = fs.readFileSync(pngPath);
  const icns = png2icons.createICNS(pngBuffer, png2icons.BICUBIC, true, 0);
  const ico = png2icons.createICO(pngBuffer, png2icons.BICUBIC, true, 0);

  if (!icns) {
    throw new Error("Failed to generate .icns from PNG");
  }
  if (!ico) {
    throw new Error("Failed to generate .ico from PNG");
  }

  fs.writeFileSync(path.join(outputDir, "coda-icon.icns"), icns);
  fs.writeFileSync(path.join(outputDir, "coda-icon.ico"), ico);
}

async function main() {
  await ensureDir(outputDir);
  const { base1024 } = await generatePngs();
  generateIcnsAndIco(base1024);
  console.log("Runner desktop icons generated in:", outputDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
