"""Выгружает все данные из старой базы (PostgreSQL на Render) в SQL-файл для Cloudflare D1.

Использование:
    pip install sqlalchemy psycopg2-binary
    python migrate/export_to_d1.py "postgresql://...External Database URL с Render..." migrate/dump.sql

Потом загрузить в D1:
    npx wrangler d1 execute expense-tracker --remote --file=migrate/dump.sql

Переносятся: пользователи (с хэшами паролей, валютой и датой регистрации),
все траты с заметками, друзья и заявки, фото профилей, токены для «Быстрых команд».
ID записей сохраняются, поэтому все связи остаются как были.
"""
import os
import re
import sys
from datetime import date, datetime, timezone

from sqlalchemy import create_engine, text

TABLES = [
    # (таблица в старой базе, таблица в D1, колонки)
    ('"user"', 'users', ['id', 'username', 'password_hash', 'currency', 'created_at']),
    ('expense', 'expenses', ['id', 'user_id', 'amount', 'category', 'note', 'expense_date', 'created_at']),
    ('friendship', 'friendships', ['id', 'from_user_id', 'to_user_id', 'status', 'created_at']),
    ('avatar', 'avatars', ['user_id', 'data', 'updated_at']),
    ('api_token', 'api_tokens', ['user_id', 'token', 'created_at']),
]
DATETIME_COLS = {'created_at', 'updated_at'}
NOW = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')


def normalize_db_url(url):
    url = url.strip().strip('\'"')
    if url.startswith('psql '):
        url = url[5:].strip().strip('\'"')
    return re.sub(r'^postgres(ql)?(\+\w+)?://', 'postgresql+psycopg2://', url)


def sql_literal(value, col):
    if value is None:
        # В D1 даты создания обязательны — для пустых ставим текущее время
        return "'" + NOW + "'" if col in DATETIME_COLS else 'NULL'
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "X'" + bytes(value).hex() + "'"
    if isinstance(value, bool):
        return '1' if value else '0'
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, datetime):
        return "'" + value.strftime('%Y-%m-%d %H:%M:%S') + "'"
    if isinstance(value, date):
        return "'" + value.isoformat() + "'"
    s = str(value)
    if col in DATETIME_COLS:
        s = s.replace('T', ' ')[:19]
    elif col == 'expense_date':
        s = s[:10]
    return "'" + s.replace("'", "''") + "'"


def main():
    # Адрес базы можно передать аргументом или через переменную DATABASE_URL (так делает GitHub Actions)
    if len(sys.argv) == 3:
        src_url, out_path = sys.argv[1], sys.argv[2]
    elif len(sys.argv) == 2 and os.environ.get('DATABASE_URL'):
        src_url, out_path = os.environ['DATABASE_URL'], sys.argv[1]
    else:
        print(__doc__)
        sys.exit(1)
    engine = create_engine(normalize_db_url(src_url))

    lines = ['-- Дамп для Cloudflare D1, создан ' + NOW + ' UTC', 'PRAGMA defer_foreign_keys = true;']
    counts = {}
    with engine.connect() as conn:
        user_ids = {r[0] for r in conn.execute(text('SELECT id FROM "user"'))}
        for src, dst, cols in TABLES:
            rows = conn.execute(text(f'SELECT {", ".join(cols)} FROM {src} ORDER BY {cols[0]}')).all()
            kept = 0
            for row in rows:
                rec = dict(zip(cols, row))
                # Пропускаем «осиротевшие» записи, ссылающиеся на удалённых пользователей
                refs = [rec[k] for k in ('user_id', 'from_user_id', 'to_user_id') if k in rec]
                if any(r not in user_ids for r in refs):
                    continue
                if dst == 'users' and not rec.get('currency'):
                    rec['currency'] = 'RUB'
                if dst == 'friendships' and not rec.get('status'):
                    rec['status'] = 'pending'
                values = ', '.join(sql_literal(rec[c], c) for c in cols)
                lines.append(f'INSERT INTO {dst} ({", ".join(cols)}) VALUES ({values});')
                kept += 1
            counts[dst] = (kept, len(rows))

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

    print(f'Готово: {out_path}')
    for dst, (kept, total) in counts.items():
        extra = f' (пропущено осиротевших: {total - kept})' if kept != total else ''
        print(f'  {dst}: {kept}{extra}')


if __name__ == '__main__':
    main()
