-- Версия сессий: смена пароля и «Выйти на всех устройствах» увеличивают её — старые куки входа перестают работать
ALTER TABLE users ADD COLUMN session_ver INTEGER NOT NULL DEFAULT 0;

-- Счётчики ограничителей частоты (src/limits.ts): ключ, номер окна, сколько раз, когда окно кончается
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  win INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  exp INTEGER NOT NULL,
  PRIMARY KEY (key, win)
);
