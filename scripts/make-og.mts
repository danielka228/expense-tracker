// Рисует public/og.png (1200×630) — картинку, которая показывается, когда ссылку на сайт отправляют в чат или соцсеть.
// Запуск: npx esbuild scripts/make-og.mts --bundle --platform=node --format=esm --outfile=/tmp/og.mjs \
//           --external:playwright && node /tmp/og.mjs
// Нужен Playwright с Chromium (npm i -g playwright) и шрифт Inter Display.

import { chromium } from 'playwright';
import { mascot } from '../src/mascot';

const OUT = new URL('../public/og.png', import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(`<html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: 'Inter Display', Inter, sans-serif; color: #fff;
    background: radial-gradient(900px 520px at 22% 50%, #3b2f8f 0%, rgba(59,47,143,0) 70%), radial-gradient(700px 400px at 100% 0%, #1d5a7a 0%, rgba(29,90,122,0) 70%), #07070c;
    display: flex; align-items: center; padding: 0 84px; gap: 52px; }
  .mascot { flex: none; width: 340px; height: 340px; filter: drop-shadow(0 28px 50px rgba(120,100,255,.45)); }
  .mascot svg { width: 100%; height: 100%; }
  h1 { font-size: 90px; font-weight: 900; letter-spacing: -1.5px; line-height: 1; }
  p { margin-top: 22px; font-size: 35px; line-height: 1.25; color: rgba(235,235,245,.78); font-weight: 500; }
  .chips { margin-top: 34px; display: flex; gap: 12px; flex-wrap: wrap; }
  .chips span { font-size: 25px; font-weight: 600; padding: 10px 20px; border-radius: 999px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.14); }
  .dom { position: absolute; right: 84px; bottom: 44px; font-size: 28px; font-weight: 700; color: rgba(235,235,245,.55); letter-spacing: .5px; }
</style></head><body>
  <div class="mascot">${mascot('wave', 340)}</div>
  <div>
    <h1>СпендТрекер</h1>
    <p>Записывай траты за пару касаний — на сайте, в Telegram или голосом</p>
    <div class="chips"><span>Сканер штрихкодов</span><span>Telegram-бот</span><span>Друзья</span></div>
  </div>
  <div class="dom">traaaack.app</div>
</body></html>`);
await page.waitForTimeout(400);
await page.screenshot({ path: OUT });
await browser.close();
console.log('ok', OUT);
