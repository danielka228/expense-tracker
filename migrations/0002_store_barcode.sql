-- Магазин и штрих-код у траты, кэш товаров (Open Food Facts) и магазинов рядом (OpenStreetMap)
ALTER TABLE expenses ADD COLUMN store TEXT;
ALTER TABLE expenses ADD COLUMN barcode TEXT;
CREATE INDEX IF NOT EXISTS idx_expenses_barcode ON expenses(barcode, expense_date);

CREATE TABLE IF NOT EXISTS products (
  barcode TEXT PRIMARY KEY,
  found INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  brand TEXT,
  quantity TEXT,
  image TEXT,
  category TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stores_cache (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
