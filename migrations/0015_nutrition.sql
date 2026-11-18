ALTER TABLE users ADD COLUMN app_mode TEXT NOT NULL DEFAULT 'expenses' CHECK(app_mode IN ('expenses', 'nutrition'));
CREATE TABLE food_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grams REAL NOT NULL CHECK(grams > 0 AND grams <= 100000),
  kcal_per_100 REAL NOT NULL CHECK(kcal_per_100 >= 0 AND kcal_per_100 <= 1000),
  meal TEXT NOT NULL CHECK(meal IN ('breakfast','lunch','dinner','snack')),
  entry_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('meal','purchase')),
  expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_food_user_date ON food_entries(user_id, entry_date, kind);
