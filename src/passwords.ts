import { pbkdf2Sync, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

// Хэши хранятся в формате werkzeug ("метод$соль$хэш"), чтобы старые пароли
// пользователей из Flask-версии продолжали подходить.
const NEW_ITERATIONS = 100_000;
const SALT_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function genSalt(length = 16): string {
  let s = '';
  for (let i = 0; i < length; i++) s += SALT_CHARS[randomInt(SALT_CHARS.length)];
  return s;
}

function hashInternal(method: string, salt: string, password: string): string | null {
  const [name, ...args] = method.split(':');
  if (name === 'scrypt') {
    const N = Number(args[0] ?? 32768);
    const r = Number(args[1] ?? 8);
    const p = Number(args[2] ?? 1);
    return scryptSync(password, salt, 64, { N, r, p, maxmem: 132 * N * r * p }).toString('hex');
  }
  if (name === 'pbkdf2') {
    const digest = args[0] ?? 'sha256';
    const iterations = Number(args[1] ?? 600000);
    const keylen = digest === 'sha512' ? 64 : digest === 'sha1' ? 20 : 32;
    return pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  }
  return null;
}

export function hashPassword(password: string): string {
  const method = `pbkdf2:sha256:${NEW_ITERATIONS}`;
  const salt = genSalt();
  return `${method}$${salt}$${hashInternal(method, salt, password)}`;
}

export function checkPassword(stored: string, password: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [method, salt, expected] = parts;
  const actual = hashInternal(method, salt, password);
  if (!actual || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

// Старые scrypt-хэши дорогие по CPU — при входе тихо пересохраняем пароль в новом формате.
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`pbkdf2:sha256:${NEW_ITERATIONS}$`);
}
