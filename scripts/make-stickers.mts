// Рисует стикеры Трэка в public/stickers/NN.png (512×512, прозрачный фон) по списку из src/stickers.ts.
// Запуск: npx esbuild scripts/make-stickers.mts --bundle --platform=node --format=esm --outfile=/tmp/stickers.mjs \
//           --external:playwright && node /tmp/stickers.mjs
// Нужен Playwright с Chromium (npm i -g playwright) и шрифты Inter Display и Noto Color Emoji.

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { mascot } from '../src/mascot';
import { STICKERS, stickerFile } from '../src/stickers';

const OUT = new URL('../public', import.meta.url).pathname;
mkdirSync(`${OUT}/stickers`, { recursive: true });

// Белая обводка вокруг фигуры, как у настоящих стикеров: «раздуваем» силуэт и заливаем белым
const OUTLINE_SVG = `<svg width="0" height="0" style="position:absolute"><filter id="outline" x="-20%" y="-20%" width="140%" height="140%">
  <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d"/><feFlood flood-color="#fff"/>
  <feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter></svg>`;
const outline = 'url(#outline)';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

const escXml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

for (const [i, s] of STICKERS.entries()) {
  const lines = s.caption.split('\n');
  const two = lines.length > 1;
  const size = Math.min(60, Math.floor(820 / Math.max(...lines.map((l) => l.length))));
  // Подпись — SVG-текст с толстой тёмной обводкой: читается и на светлом, и на тёмном фоне чата
  const caption = `<svg class="cap" width="512" height="${two ? 140 : 84}" viewBox="0 0 512 ${two ? 140 : 84}">
    ${lines
      .map(
        (l, k) => `<text x="256" y="${(two ? 58 : 64) + k * (size + 4)}" text-anchor="middle" font-family="Inter Display, Inter, sans-serif"
          font-weight="900" font-size="${size}" fill="#fff" stroke="#1c1c2e" stroke-width="11" stroke-linejoin="round"
          paint-order="stroke" letter-spacing="1.5">${escXml(l)}</text>`,
      )
      .join('')}
  </svg>`;
  await page.setContent(`<html><head><style>
    * { margin: 0; box-sizing: border-box; }
    html, body { width: 512px; height: 512px; background: transparent; overflow: hidden; }
    .kopi * { animation: none !important; }
    .kopi .kopi-shadow { display: none; }
    .stage { position: relative; width: 512px; height: 512px; }
    .fig { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); filter: ${outline} drop-shadow(0 6px 10px rgba(0,0,0,.22)); }
    .prop { position: absolute; right: 60px; top: 50px; font-size: 92px; line-height: 1; transform: rotate(12deg);
      font-family: "Noto Color Emoji"; filter: ${outline}; }
    .cap { position: absolute; left: 0; bottom: 0; }
  </style></head><body>${OUTLINE_SVG}<div class="stage">
    <div class="fig">${mascot(s.mood, two ? 270 : 325)}</div>
    ${s.prop ? `<div class="prop">${s.prop}</div>` : ''}
    ${caption}
  </div></body></html>`);
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}${stickerFile(i)}`, omitBackground: true });
  console.log('✓', stickerFile(i), s.caption.replace('\n', ' '));
}
await browser.close();
