ALTER TABLE food_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'estimate', 'label'));
ALTER TABLE food_entries ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX idx_food_request ON food_entries(user_id, request_key) WHERE request_key IS NOT NULL;
