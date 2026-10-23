-- Язык интерфейса сайта: 'ru' (по умолчанию) или 'en'.
ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'ru';
