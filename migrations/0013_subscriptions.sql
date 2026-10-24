-- Подписки: регулярные списания (Netflix, спортзал, связь). В день списания трата записывается сама.
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'month', -- month | year | week
  next_date TEXT NOT NULL,               -- дата ближайшего списания, YYYY-MM-DD
  anchor_day INTEGER NOT NULL,           -- число месяца, на которое приходится списание (31 → последний день короткого месяца)
  category TEXT NOT NULL DEFAULT 'Развлечения',
  auto INTEGER NOT NULL DEFAULT 1,       -- 1 — в день списания записать трату
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next ON subscriptions(next_date);
