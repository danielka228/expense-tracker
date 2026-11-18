CREATE TABLE food_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grams REAL NOT NULL CHECK(grams > 0 AND grams <= 100000),
  kcal_per_100 REAL NOT NULL CHECK(kcal_per_100 >= 0 AND kcal_per_100 <= 1000),
  meal TEXT NOT NULL CHECK(meal IN ('breakfast','lunch','dinner','snack')),
  entry_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('meal','purchase')),
  expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','estimate','label','catalog')),
  request_key TEXT
);
INSERT INTO food_entries_new (id,user_id,name,grams,kcal_per_100,meal,entry_date,kind,expense_id,created_at,source,request_key)
  SELECT id,user_id,name,grams,kcal_per_100,meal,entry_date,kind,expense_id,created_at,source,request_key FROM food_entries;
DROP TABLE food_entries;
ALTER TABLE food_entries_new RENAME TO food_entries;
CREATE INDEX idx_food_user_date ON food_entries(user_id, entry_date, kind);
CREATE UNIQUE INDEX idx_food_request ON food_entries(user_id, request_key) WHERE request_key IS NOT NULL;
