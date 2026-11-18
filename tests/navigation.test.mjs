import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/views.ts', 'src/nutrition-view.ts'], bundle: true, write: false, outdir: 'out', platform: 'node', format: 'esm' });
const modules = await Promise.all(bundle.outputFiles.map(f => import(`data:text/javascript;base64,${Buffer.from(f.text).toString('base64')}`)));
const { settingsPage, layout } = modules[0];
const { nutritionPage } = modules[1];
const nav = html => String(html).match(/<nav class="tabbar"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
const settings = { flashes: [], username: 'test', hasPassword: false, telegram: { linked: false, tgUsername: null, bot: null, login: false }, currencies: { RUB: { label: 'Рубль', symbol: '₽' } }, currentCurrency: 'RUB' };

test('settings navigation follows the saved app mode in both languages', async () => {
  for (const [lang, food, groceries] of [['ru', 'Питание', 'Продукты'], ['en', 'Nutrition', 'Groceries']]) {
    const html = nav(await settingsPage({ ...settings, lang, appMode: 'nutrition' }));
    assert.ok(html);
    assert.match(html, /href="\/nutrition"/);
    assert.match(html, /href="\/nutrition#food-purchases"/);
    assert.ok(html.includes(food) && html.includes(groceries));
    assert.doesNotMatch(html, /href="\/subs"|href="\/dashboard"/);
    assert.match(html, /tab active[^>]*href="\/settings"/);
  }
});

test('expense mode keeps expenses and subscriptions navigation', async () => {
  for (const appMode of ['expenses', undefined]) {
    const html = nav(await settingsPage({ ...settings, lang: 'ru', appMode }));
    assert.match(html, /href="\/dashboard"/);
    assert.match(html, /href="\/subs"/);
    assert.ok(html.includes('Траты') && html.includes('Подписки'));
  }
});

test('nutrition navigation targets a real purchases section and preserves other tabs', async () => {
  const html = String(await nutritionPage({ entries: [], date: '2026-11-18', lang: 'ru', ai: false, currency: 'RUB' }));
  assert.match(html, /id="food-purchases"/);
  for (const activeTab of ['friends', 'profile', 'settings']) {
    const menu = nav(await layout({ title: 'Test', flashes: [], loggedIn: true, nutrition: true, lang: 'ru', activeTab }, ''));
    assert.match(menu, new RegExp(`tab active[^>]*href="/${activeTab}"`));
    assert.match(menu, /href="\/nutrition#food-purchases"/);
  }
});
