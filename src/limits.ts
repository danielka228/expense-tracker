// Ограничители частоты: защита от перебора паролей, массовых регистраций и расхода Workers AI.
// Счётчик живёт в D1: окно фиксированной длины, один атомарный upsert — гонки между запросами не страшны.

/** Засчитывает попытку по ключу. false — лимит в этом окне исчерпан. */
export async function hit(db: D1Database, key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const win = Math.floor(now / windowSec);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, win, n, exp) VALUES (?, ?, 1, ?)
       ON CONFLICT(key, win) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n`,
    )
    .bind(key, win, (win + 1) * windowSec, limit)
    .first();
  return !!row;
}

/** Общий потолок вызовов Workers AI в сутки на весь сайт: фото, голосовые и причёсывание названий */
export const aiDayAllowed = (db: D1Database) => hit(db, 'ai:day', 1500, 86400);

/** Старые окна больше не нужны — чистим раз в сутки по расписанию */
export const cleanupLimits = (db: D1Database) =>
  db.prepare('DELETE FROM rate_limits WHERE exp < ?').bind(Math.floor(Date.now() / 1000)).run();
