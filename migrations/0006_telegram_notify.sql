-- Сообщения от Трэка (вечерние и недельные итоги): 1 — присылать, 0 — нет
ALTER TABLE telegram_links ADD COLUMN notify INTEGER NOT NULL DEFAULT 1;
