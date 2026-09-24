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

const LOGO = `<svg width="40" height="40" viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="16" fill="${MARK}" stroke="${INK}" stroke-width="8"/><path d="M28 52 L44 67 L73 33" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const cardHtml = `<!doctype html><meta charset="utf-8">${FONT.replace('wght@8..60,700', 'ital,opsz,wght@0,8..60,700;1,8..60,500')}
<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:${PAPER};box-sizing:border-box;padding:64px 72px;
       display:grid;grid-template-columns:1.2fr .8fr;gap:48px;align-items:center;font-family:'Public Sans',sans-serif;color:${INK}}
  .top{display:flex;align-items:center;gap:14px;font-weight:700;font-size:28px;margin-bottom:34px;white-space:nowrap}
  .tag{font-weight:500;color:${INK_2};margin-left:4px;padding-left:16px;border-left:2px solid #bdb7a9}
  h1{font-family:'Source Serif 4',Georgia,serif;font-size:66px;line-height:1.06;margin:0 0 28px;letter-spacing:-1px}
  .hl{background:linear-gradient(transparent 54%,${MARK} 54%,${MARK} 96%,transparent 96%)}
  .sub{font-size:28px;color:${INK_2};font-weight:600}
  .card{background:#fff;border:2px solid #dedad0;border-radius:18px;padding:26px;box-shadow:0 18px 40px -22px rgba(22,24,29,.35)}
  .b{border-radius:16px;padding:14px 18px;font-size:22px;line-height:1.4}
  .you{background:#efebe2;margin:0 0 14px 40px}
  .ai{background:#f4f5f7;border:1px solid #e3e5ea}
  .s{text-decoration:line-through;text-decoration-thickness:3px;background:linear-gradient(transparent 50%,${MARK} 50%,${MARK} 90%,transparent 90%)}
  .n{font-family:'Source Serif 4',Georgia,serif;font-style:italic;font-weight:500;font-size:22px;margin:18px 0 0;padding-left:14px;border-left:4px solid ${INK}}
</style>
<div>
  <div class="top">${LOGO}AI Election Errors<span class="tag">Report the Bot</span></div>
  <h1>Did an AI give you <span class="hl">wrong</span> election information?</h1>
  <div class="sub">Report AI election misinformation.</div>
</div>
<div class="card">
  <div class="b you">When is the deadline to register to vote here?</div>
  <div class="b ai">The deadline is <span class="s">October 5</span>.</div>
  <p class="n">That was last election's date.</p>
</div>`;

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
await shot(cardHtml, 1200, 630, 'og-ai-election-errors-report-the-bot-1200x630.png');
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
