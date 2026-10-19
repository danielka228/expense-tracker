-- Меню бота «Добавить → категория»: категория ждёт, пока пользователь пришлёт сумму (10 минут)
ALTER TABLE telegram_links ADD COLUMN pending_category TEXT;
ALTER TABLE telegram_links ADD COLUMN pending_at TEXT;
