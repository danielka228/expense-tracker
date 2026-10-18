-- Telegram-бот: какой чат к какому аккаунту привязан
CREATE TABLE IF NOT EXISTS telegram_links (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id INTEGER NOT NULL UNIQUE,
  tg_username TEXT,
  linked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Одноразовые коды из ссылки t.me/<бот>?start=<код>: по ним бот узнаёт, чей это чат
CREATE TABLE IF NOT EXISTS telegram_codes (
  code TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
