-- База растёт сама: товары, которые пользователи назвали сами, и несетевые магазины, добавленные вручную
ALTER TABLE products ADD COLUMN source TEXT NOT NULL DEFAULT 'off';

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_places_pos ON places(lat, lon);
