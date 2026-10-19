// Рисует анимированные (видео) стикеры Трэка: public/stickers/anim/NN.webm — VP9 с прозрачностью,
// 512×512, 30 кадров/с, 2 секунды по кругу, до 256 КБ (требования Telegram). Список — src/stickers.ts.
// Кадры снимает Chromium: CSS-анимации ставятся на паузу и перематываются на нужный момент, затем ffmpeg
// собирает их в WEBM. Запуск — как у make-stickers.mts; нужен ffmpeg с libvpx-vp9.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { mascot, type Mood } from '../src/mascot';
import { STICKERS, animStickerFile } from '../src/stickers';

const OUT = new URL('../public', import.meta.url).pathname;
mkdirSync(`${OUT}/stickers/anim`, { recursive: true });
const FPS = 30;
const LOOP_MS = 2000;
const MAX_BYTES = 256 * 1024;

const OUTLINE_SVG = `<svg width="0" height="0" style="position:absolute"><filter id="outline" x="-20%" y="-20%" width="140%" height="140%">
  <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d"/><feFlood flood-color="#fff"/>
  <feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter></svg>`;

// Движение всей фигуры по настроению. Всё укладывается в 2 секунды, чтобы стикер крутился без рывка.
const BODY: Record<Mood, string> = {
  wave: 'bob 1s ease-in-out infinite',
  happy: 'bounce 1s cubic-bezier(.3,.8,.4,1) infinite',
  wow: 'jump 2s cubic-bezier(.3,1.4,.5,1) infinite',
  worried: 'shake 1s ease-in-out infinite',
  sleep: 'breathe 2s ease-in-out infinite',
  wink: 'tilt 2s ease-in-out infinite',
  love: 'heart 1s ease-in-out infinite',
  sad: 'droop 2s ease-in-out infinite',
  cool: 'groove 1s ease-in-out infinite',
};

const CSS = `
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 512px; height: 512px; background: transparent; overflow: hidden; }
  .stage { position: relative; width: 512px; height: 512px; }
  .fig { position: absolute; left: 0; right: 0; display: flex; justify-content: center; filter: url(#outline) drop-shadow(0 6px 10px rgba(0,0,0,.22)); }
  .move { transform-origin: 50% 100%; }
  .kopi-shadow { display: none; }
  .kopi-eyes { transform-box: fill-box; transform-origin: center; animation: blink 2s infinite; }
  .kopi-wave { transform-box: fill-box; transform-origin: 0% 100%; animation: wave .5s ease-in-out infinite alternate; }
  .kopi-z { animation: zz 1s ease-in-out infinite; }
  .prop { position: absolute; right: 60px; top: 50px; font-size: 92px; line-height: 1; font-family: "Noto Color Emoji";
    filter: url(#outline); animation: prop 1s ease-in-out infinite; }
  .cap { position: absolute; left: 0; bottom: 0; transform-origin: 50% 70%; animation: cap 2s ease-in-out infinite; }
  @keyframes blink { 0%, 80%, 90%, 100% { transform: scaleY(1); } 85% { transform: scaleY(.08); } }
  @keyframes wave { from { transform: rotate(-20deg); } to { transform: rotate(16deg); } }
  @keyframes zz { 0% { opacity: 0; transform: translateY(6px); } 50% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }
  @keyframes prop { 0%, 100% { transform: rotate(6deg) translateY(0); } 50% { transform: rotate(18deg) translateY(-12px); } }
  @keyframes cap { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  @keyframes bounce { 0%, 100% { transform: translateY(0) scale(1.06, .94); } 15% { transform: translateY(0) scale(1, 1); } 50% { transform: translateY(-34px) scale(.97, 1.04); } 85% { transform: translateY(0) scale(1, 1); } }
  @keyframes jump { 0%, 30%, 100% { transform: translateY(0) scale(1); } 10% { transform: translateY(4px) scale(1.08, .9); } 20% { transform: translateY(-46px) scale(.94, 1.08); } }
  @keyframes shake { 0%, 50%, 100% { transform: rotate(0); } 10%, 30% { transform: rotate(-6deg); } 20%, 40% { transform: rotate(6deg); } }
  @keyframes breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.04, .97); } }
  @keyframes tilt { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
  @keyframes heart { 0%, 40%, 100% { transform: scale(1); } 15% { transform: scale(1.1); } 28% { transform: scale(1.02); } }
  @keyframes droop { 0%, 100% { transform: rotate(-3deg) translateY(4px); } 50% { transform: rotate(3deg) translateY(0); } }
  @keyframes groove { 0%, 100% { transform: rotate(-5deg) translateX(-6px); } 50% { transform: rotate(5deg) translateX(6px); } }
`;

const escXml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

for (const [i, s] of STICKERS.entries()) {
  const lines = s.caption.split('\n');
  const two = lines.length > 1;
  const size = Math.min(60, Math.floor(820 / Math.max(...lines.map((l) => l.length))));
  const caption = `<svg class="cap" width="512" height="${two ? 140 : 84}" viewBox="0 0 512 ${two ? 140 : 84}">${lines
    .map(
      (l, k) => `<text x="256" y="${(two ? 58 : 64) + k * (size + 4)}" text-anchor="middle" font-family="Inter Display, Inter, sans-serif"
        font-weight="900" font-size="${size}" fill="#fff" stroke="#1c1c2e" stroke-width="11" stroke-linejoin="round"
        paint-order="stroke" letter-spacing="1.5">${escXml(l)}</text>`,
    )
    .join('')}</svg>`;
  await page.setContent(`<html><head><style>${CSS}</style></head><body>${OUTLINE_SVG}<div class="stage">
    <div class="fig" style="top:${two ? 40 : 46}px"><div class="move" style="animation:${BODY[s.mood]}">${mascot(s.mood, two ? 250 : 290)}</div></div>
    ${s.prop ? `<div class="prop">${s.prop}</div>` : ''}
    ${caption}
  </div></body></html>`);
  await page.evaluate(() => document.fonts.ready);

  const dir = mkdtempSync(join(tmpdir(), 'trek-anim-'));
  const frames = (LOOP_MS / 1000) * FPS;
  for (let f = 0; f < frames; f++) {
    // Перематываем все анимации на нужный момент и снимаем кадр
    await page.evaluate((t) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = t;
      }
    }, (f * 1000) / FPS);
    await page.screenshot({ path: join(dir, `f${String(f).padStart(3, '0')}.png`), omitBackground: true });
  }

  // Собираем WEBM; если вышло больше 256 КБ — жмём сильнее
  const out = `${OUT}${animStickerFile(i)}`;
  for (const crf of [30, 36, 42, 48]) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%03d.png'),
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', String(crf), '-an', out]);
    if (statSync(out).size <= MAX_BYTES) break;
  }
  rmSync(dir, { recursive: true, force: true });
  console.log('✓', animStickerFile(i), `${Math.round(statSync(out).size / 1024)} КБ`, s.caption.replace('\n', ' '));
}
await browser.close();
