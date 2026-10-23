
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

async function generateIcon() {
  const root = path.resolve(__dirname, "..");
  const assetsDir = path.join(root, "assets");

  const svgPath = path.join(
    assetsDir,
    "luna-icon.svg"
  );

  const pngPath = path.join(
    assetsDir,
    "luna-icon.png"
  );

  const icoPath = path.join(
    assetsDir,
    "luna-icon.ico"
  );

  const svg = await fs.readFile(svgPath);

  const png = await sharp(svg)
    .resize(256, 256)
    .png()
    .toBuffer();

  await fs.writeFile(pngPath, png);

  const imported = await import("png-to-ico");
  const pngToIco = imported.default || imported;

  const ico = await pngToIco(png);
  await fs.writeFile(icoPath, ico);

  console.log("Luna icons generated successfully!");
  console.log("PNG:", pngPath);
  console.log("ICO:", icoPath);
}

generateIcon().catch(error => {
  console.error("Icon generation failed:", error);
  process.exitCode = 1;
});
