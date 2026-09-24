// Renders the home-screen icons, favicon and link-preview card from the page's own colours.
//   npm run icons
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const OUT = process.cwd();
const PAPER = '#f6f4ef';
const INK = '#16181d';
const INK_2 = '#4a4f5a';
const MARK = '#ffd84d';
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@600;700&family=Source+Serif+4:opsz,wght@8..60,700&display=swap" rel="stylesheet">';

// The page's brand mark, a highlighter-yellow ballot box, on ink: reads at 40px on a phone.
const iconHtml = (px) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0}body{width:${px}px;height:${px}px;background:${INK};display:flex;align-items:center;justify-content:center}</style>
<svg width="${px * 0.62}" height="${px * 0.62}" viewBox="0 0 100 100">
  <rect x="6" y="6" width="88" height="88" rx="14" fill="${MARK}"/>
  <path d="M27 52 L44 68 L74 32" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const cardHtml = `<!doctype html><meta charset="utf-8">${FONT}
<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:${PAPER};box-sizing:border-box;padding:72px 90px;
       display:flex;flex-direction:column;justify-content:space-between;font-family:'Public Sans',sans-serif;color:${INK}}
  .top{display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px}
  .dot{width:26px;height:26px;border-radius:5px;background:${MARK};border:4px solid ${INK}}
  h1{font-family:'Source Serif 4',Georgia,serif;font-size:84px;line-height:1.05;margin:0;letter-spacing:-1px}
  .hl{background:linear-gradient(transparent 58%,${MARK} 58%,${MARK} 92%,transparent 92%)}
  .sub{font-size:32px;color:${INK_2};font-weight:600}
</style>
<div class="top"><span class="dot"></span>AI Election Errors</div>
<h1>Did an AI give you <span class="hl">wrong</span> election information?</h1>
<div class="sub">Report it. Help build the public record.</div>`;

const browser = await chromium.launch();
async function shot(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, file), type: 'png' });
  await page.close();
  console.log('wrote', file);
}
for (const px of [32, 180, 192, 512]) await shot(iconHtml(px), px, px, `icon-ai-election-errors-${px}.png`);
await shot(cardHtml, 1200, 630, 'og-ai-election-errors-1200x630.png');
await browser.close();

// favicon.ico wrapping the 32px PNG (ICO files may embed a PNG directly).
const png = readFileSync(path.join(OUT, 'icon-ai-election-errors-32.png'));
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head.writeUInt8(32, 6); head.writeUInt8(32, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, png]));
console.log('wrote favicon.ico');
