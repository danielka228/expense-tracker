-- Откуда человек пришёл в бота: метка из ссылки t.me/<бот>?start=<метка> (ig, tt, habr…). Запоминаем первую
CREATE TABLE IF NOT EXISTS tg_sources (
  chat_id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
