import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { App } from './index';
import { langOf } from './i18n';
import { takeAiQuota } from './vision';
import { compareFoodCandidates, recognizeFood } from './nutrition-ai';
import { searchFoodProducts } from './nutrition-search';
import { readFood, validDate, foodNumber, type Food } from './nutrition-data';
import { nutritionPage } from './nutrition-view';

export const nutritionRoutes = new Hono<App>();
// Limit the stream before buffering multipart images, including requests without Content-Length.
nutritionRoutes.use('*', bodyLimit({ maxSize: 4 * 1024 * 1024, onError: c => c.json({ error: 'too_large' }, 413) }));
nutritionRoutes.get('/', async c => {
  const day = c.req.query('date') || new Date().toISOString().slice(0, 10);
  if (!validDate(day)) return c.text('Invalid date', 400);
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT f.*, e.amount AS price FROM food_entries f LEFT JOIN expenses e ON e.id=f.expense_id AND e.user_id=f.user_id WHERE f.user_id = ? AND f.entry_date = ? ORDER BY f.id DESC').bind(user.id, day).all<Food>();
  return c.html(nutritionPage({ entries: results, date: day, lang: langOf(user.lang), ai: !!c.env.AI, currency: user.currency }));
});
nutritionRoutes.post('/save', async c => {
  const f = await c.req.parseBody();
  const entry = readFood(f);
  if (!entry) return c.json({ error: 'invalid' }, 400);
  const user = c.get('user');
  const id = f.id ? foodNumber(f.id, Number.MAX_SAFE_INTEGER) : null;
  if (f.id && (!id || !Number.isInteger(id))) return c.json({ error: 'invalid' }, 400);
  const amount = f.amount ? foodNumber(f.amount, 9999999) : null;
  if (f.amount && amount === null) return c.json({ error: 'invalid' }, 400);
  if (id) {
    const old = await c.env.DB.prepare('SELECT id,expense_id FROM food_entries WHERE id = ? AND user_id = ?').bind(id, user.id).first<{id:number;expense_id:number|null}>();
    if (!old) return c.json({ error: 'not_found' }, 404);
    const linkedExpense = old.expense_id && entry.kind === 'purchase' && amount !== null;
    const updateFood = c.env.DB.prepare('UPDATE food_entries SET name=?, grams=?, kcal_per_100=?, meal=?, entry_date=?, kind=?, source=? WHERE id=? AND user_id=?')
      .bind(entry.name, entry.grams, entry.kcal, entry.meal, entry.date, entry.kind, entry.source, id, user.id);
    if (old.expense_id && linkedExpense) {
      await c.env.DB.batch([
        updateFood,
        c.env.DB.prepare('UPDATE expenses SET amount=?,note=?,expense_date=? WHERE id=? AND user_id=?').bind(amount, entry.name, entry.date, old.expense_id, user.id),
      ]);
    } else if (old.expense_id && entry.kind !== 'purchase') {
      // Clear the foreign key before deleting the linked expense; the row is now a meal, not a purchase.
      await c.env.DB.batch([
        c.env.DB.prepare('UPDATE food_entries SET expense_id=NULL WHERE id=? AND user_id=?').bind(id, user.id),
        updateFood,
        c.env.DB.prepare('DELETE FROM expenses WHERE id=? AND user_id=?').bind(old.expense_id, user.id),
      ]);
    } else if (old.expense_id && amount === null) {
      await c.env.DB.batch([
        c.env.DB.prepare('UPDATE food_entries SET expense_id=NULL WHERE id=? AND user_id=?').bind(id, user.id),
        updateFood,
        c.env.DB.prepare('DELETE FROM expenses WHERE id=? AND user_id=?').bind(old.expense_id, user.id),
      ]);
    } else if (entry.kind === 'purchase' && amount !== null) {
      await c.env.DB.batch([
        updateFood,
        c.env.DB.prepare("INSERT INTO expenses (user_id,amount,category,note,expense_date) VALUES (?,?,'Еда',?,?)").bind(user.id, amount, entry.name, entry.date),
        c.env.DB.prepare('UPDATE food_entries SET expense_id=last_insert_rowid() WHERE id=? AND user_id=?').bind(id, user.id),
      ]);
    } else await updateFood.run();
  } else {
    const key = typeof f.request_key === 'string' ? f.request_key : crypto.randomUUID();
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(key)) return c.json({ error: 'invalid' }, 400);
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
  const id = Number(c.req.param('id'));
  const userId = c.get('user').id;
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM expenses WHERE id=(SELECT expense_id FROM food_entries WHERE id=? AND user_id=?) AND user_id=?').bind(id, userId, userId),
    c.env.DB.prepare('DELETE FROM food_entries WHERE id=? AND user_id=?').bind(id, userId),
  ]);
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
  if (!guess) return c.json({ error: 'unknown' }, 422);
  if (!guess.is_food) return c.json({ error: 'not_food' }, 422);
  const matches = await searchFoodProducts(guess.name, guess.brand);
  const visualMatch = matches.length ? await compareFoodCandidates(c.env.AI, bytes, matches) : null;
  return c.json({ ok: true, guess, matches, visualMatch });
});
