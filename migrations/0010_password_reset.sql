-- «Забыли пароль?»: одноразовые ссылки, которые бот присылает в привязанный Telegram.
-- Храним только SHA-256 токена — утечка базы не даёт готовых ссылок.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exp INTEGER NOT NULL
);
