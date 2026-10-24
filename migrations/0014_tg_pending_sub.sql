-- Telegram-бот: человек выбрал в меню «Добавить подписку» сервис и бот ждёт сумму и число списания.
-- Название сервиса ('*' — своя подписка, название придёт в сообщении). Срок ожидания — как у pending_category (pending_at).
ALTER TABLE telegram_links ADD COLUMN pending_sub TEXT;
