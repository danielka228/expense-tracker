import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { App } from './index';
import { langOf } from './i18n';
import { takeAiQuota } from './vision';
import { recognizeFood } from './nutrition-ai';
import { readFood, validDate, foodNumber, type Food } from './nutrition-data';
import { nutritionPage } from './nutrition-view';

export const nutritionRoutes = new Hono<App>();
// Limit the stream before buffering multipart images, including requests without Content-Length.
nutritionRoutes.use('*', bodyLimit({ maxSize: 4 * 1024 * 1024, onError: c => c.json({ error: 'too_large' }, 413) }));
nutritionRoutes.get('/', async c => {
  const day = c.req.query('date') || new Date().toISOString().slice(0, 10);
  if (!validDate(day)) return c.text('Invalid date', 400);
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM food_entries WHERE user_id = ? AND entry_date = ? ORDER BY id DESC').bind(user.id, day).all<Food>();
  return c.html(nutritionPage({ entries: results, date: day, lang: langOf(user.lang), ai: !!c.env.AI, currency: user.currency }));
});
nutritionRoutes.post('/save', async c => {
  const f = await c.req.parseBody();
  const entry = readFood(f);
  if (!entry) return c.json({ error: 'invalid' }, 400);
  const user = c.get('user');
  const id = f.id ? foodNumber(f.id, Number.MAX_SAFE_INTEGER) : null;
  if (f.id && (!id || !Number.isInteger(id))) return c.json({ error: 'invalid' }, 400);
  if (id) {
    const old = await c.env.DB.prepare('SELECT id FROM food_entries WHERE id = ? AND user_id = ?').bind(id, user.id).first();
    if (!old) return c.json({ error: 'not_found' }, 404);
    await c.env.DB.prepare('UPDATE food_entries SET name=?, grams=?, kcal_per_100=?, meal=?, entry_date=?, kind=?, source=? WHERE id=? AND user_id=?')
      .bind(entry.name, entry.grams, entry.kcal, entry.meal, entry.date, entry.kind, entry.source, id, user.id).run();
  } else {
    const key = typeof f.request_key === 'string' ? f.request_key : crypto.randomUUID();
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(key)) return c.json({ error: 'invalid' }, 400);
    const amount = f.amount ? foodNumber(f.amount, 9999999) : null;
    if (f.amount && amount === null) return c.json({ error: 'invalid' }, 400);
    const insert = c.env.DB.prepare('INSERT OR IGNORE INTO food_entries (user_id,name,grams,kcal_per_100,meal,entry_date,kind,expense_id,source,request_key) VALUES (?,?,?,?,?,?,?,NULL,?,?)').bind(user.id, entry.name, entry.grams, entry.kcal, entry.meal, entry.date, entry.kind, entry.source, key);
    if (entry.kind === 'purchase' && amount !== null) {
      // One transaction: a failure cannot leave an expense without its food purchase.
      await c.env.DB.batch([
        insert,
        c.env.DB.prepare("INSERT INTO expenses (user_id,amount,category,note,expense_date) SELECT ?,?,'Еда',?,? WHERE changes() = 1").bind(user.id, amount, entry.name, entry.date),
        c.env.DB.prepare('UPDATE food_entries SET expense_id=last_insert_rowid() WHERE user_id=? AND request_key=? AND expense_id IS NULL AND changes()=1').bind(user.id, key),
      ]);
    } else await insert.run();
    // A replay can arrive after the first response was lost. Do not silently discard edited data.
    const saved = await c.env.DB.prepare('SELECT f.*, e.amount AS price FROM food_entries f LEFT JOIN expenses e ON e.id=f.expense_id WHERE f.user_id=? AND f.request_key=?')
      .bind(user.id, key).first<Food & { price: number | null }>();
    if (!saved || saved.name !== entry.name || saved.grams !== entry.grams || saved.kcal_per_100 !== entry.kcal || saved.meal !== entry.meal || saved.entry_date !== entry.date || saved.kind !== entry.kind || saved.source !== entry.source || (entry.kind === 'purchase' && saved.price !== amount)) {
      return c.json({ error: 'already_saved' }, 409);
    }
  }
  return c.json({ ok: true });
});
nutritionRoutes.post('/delete/:id', async c => {
  await c.env.DB.prepare('DELETE FROM food_entries WHERE id=? AND user_id=?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});
nutritionRoutes.post('/analyze', async c => {
  if (!c.env.AI) return c.json({ error: 'ai_off' }, 503);
  const f = await c.req.parseBody();
  const file = f.photo;
  if (!(file instanceof File) || file.size > 3 * 1024 * 1024) return c.json({ error: 'bad_image' }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return c.json({ error: 'bad_image' }, 400);
  const context = typeof f.context === 'string' ? f.context : '';
  if (context.length > 6000) return c.json({ error: 'invalid' }, 400);
  if (!(await takeAiQuota(c.env.DB, c.get('user').id))) return c.json({ error: 'limit' }, 429);
  const guess = await recognizeFood(c.env.AI, bytes, context, langOf(c.get('user').lang));
  return guess ? c.json({ ok: true, guess }) : c.json({ error: 'unknown' }, 422);
});
