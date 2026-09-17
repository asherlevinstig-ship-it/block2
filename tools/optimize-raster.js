const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');

async function main() {
  const [input, output, widthArg = '1920', qualityArg = '82'] = process.argv.slice(2);
  if (!input || !output) throw new Error('usage: node tools/optimize-raster.js <input> <output.webp> [maxWidth] [quality]');
  const maxWidth = Math.max(320, Math.min(4096, Number(widthArg) || 1920));
  const quality = Math.max(0.4, Math.min(1, (Number(qualityArg) || 82) / 100));
  const source = await fs.readFile(path.resolve(input));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async ({ data, maxWidth, quality }) => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + data;
      await image.decode();
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      return {
        data: await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.readAsDataURL(blob);
        }),
        width: canvas.width,
        height: canvas.height,
      };
    }, { data: source.toString('base64'), maxWidth, quality });
    await fs.writeFile(path.resolve(output), Buffer.from(result.data, 'base64'));
    console.log(`Optimized ${input} to ${output} (${result.width}x${result.height})`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
