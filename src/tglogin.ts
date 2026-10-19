// «Войти через Telegram» на обычном сайте: OpenID Connect от Telegram (https://core.telegram.org/bots/telegram-login).
// Сайт отправляет человека на oauth.telegram.org, Telegram спрашивает «Разрешить вход?» и возвращает
// на /auth/telegram/callback с кодом. Код меняем на id_token (JWT), проверяем подпись по ключам Telegram
// и берём из него Telegram ID — тот же, что у чата с ботом, поэтому вход и бот работают с одним аккаунтом.

export const TG_ISSUER = 'https://oauth.telegram.org';
const AUTH_URL = `${TG_ISSUER}/auth`;
const TOKEN_URL = `${TG_ISSUER}/token`;
const JWKS_URL = `${TG_ISSUER}/.well-known/jwks.json`;

export interface TgLoginConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer?: string; // только для локальной проверки: адрес заглушки вместо oauth.telegram.org
}

export interface TgIdentity {
  id: number; // Telegram ID пользователя (claim "id", приходит со scope profile)
  username: string | null;
  name: string | null;
  picture: string | null;
}

// Одноразовые значения запроса: state — от подмены ответа, nonce — от повтора токена, verifier — PKCE
export interface TgLoginState {
  state: string;
  nonce: string;
  verifier: string;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export function newLoginState(): TgLoginState {
  return { state: random(), nonce: random(), verifier: random(48) };
}

export async function authorizeUrl(cfg: TgLoginConfig, s: TgLoginState): Promise<string> {
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.verifier))));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: 'openid profile',
    state: s.state,
    nonce: s.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    lang: 'ru',
  });
  return `${cfg.issuer ? `${cfg.issuer}/auth` : AUTH_URL}?${q}`;
}

// Код → id_token. Секрет клиента отправляем в заголовке (client_secret_basic), а если сервер
// так не принимает — повторяем в теле запроса (client_secret_post).
async function exchangeCode(cfg: TgLoginConfig, code: string, verifier: string): Promise<string> {
  const url = cfg.issuer ? `${cfg.issuer}/token` : TOKEN_URL;
  const params = { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier, client_id: cfg.clientId };
  const send = (body: Record<string, string>, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', ...headers },
      body: new URLSearchParams(body),
    });
  let res = await send(params, { Authorization: `Basic ${btoa(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`)}` });
  if (res.status === 400 || res.status === 401) res = await send({ ...params, client_secret: cfg.clientSecret });
  const j = await res.json<{ id_token?: string; error?: string; error_description?: string }>().catch(() => ({}) as { id_token?: string; error?: string });
  if (!res.ok || !j.id_token) throw new Error(`token: ${res.status} ${j.error ?? ''}`);
  return j.id_token;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}
let jwksCache: { at: number; keys: Jwk[] } | null = null;

async function signingKeys(cfg: TgLoginConfig, fresh = false): Promise<Jwk[]> {
  if (!fresh && jwksCache && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(cfg.issuer ? `${cfg.issuer}/.well-known/jwks.json` : JWKS_URL);
  const j = await res.json<{ keys?: Jwk[] }>();
  jwksCache = { at: Date.now(), keys: j.keys ?? [] };
  return jwksCache.keys;
}

type Alg = Parameters<typeof crypto.subtle.verify>[0];
const ALGS: Record<string, { imp: Alg & Record<string, unknown>; verify: Alg }> = {
  RS256: { imp: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verify: { name: 'RSASSA-PKCS1-v1_5' } },
  ES256: { imp: { name: 'ECDSA', namedCurve: 'P-256' }, verify: { name: 'ECDSA', hash: 'SHA-256' } },
  EdDSA: { imp: { name: 'Ed25519' }, verify: { name: 'Ed25519' } },
};

// Проверка id_token: подпись ключом Telegram, издатель, наш client_id, срок и nonce из нашего запроса
async function verifyIdToken(cfg: TgLoginConfig, jwt: string, nonce: string): Promise<Record<string, unknown>> {
  const [h, p, sig] = jwt.split('.');
  if (!h || !p || !sig) throw new Error('jwt: формат');
  const header = JSON.parse(new TextDecoder().decode(fromB64url(h))) as { alg?: string; kid?: string };
  const alg = ALGS[header.alg ?? ''];
  if (!alg) throw new Error(`jwt: алгоритм ${header.alg}`);
  const signed = new TextEncoder().encode(`${h}.${p}`);
  const verifyWith = async (keys: Jwk[]) => {
    for (const jwk of keys.filter((k) => !header.kid || k.kid === header.kid)) {
      try {
        const key = await crypto.subtle.importKey('jwk', jwk, alg.imp, false, ['verify']);
        if (await crypto.subtle.verify(alg.verify, key, fromB64url(sig), signed)) return true;
      } catch {
        // ключ другого типа — пробуем следующий
      }
    }
    return false;
  };
  // Не подошёл ни один ключ из кэша — возможно, Telegram сменил ключи: скачиваем заново и проверяем ещё раз
  if (!(await verifyWith(await signingKeys(cfg))) && !(await verifyWith(await signingKeys(cfg, true)))) throw new Error('jwt: подпись');

  const c = JSON.parse(new TextDecoder().decode(fromB64url(p))) as Record<string, unknown>;
  const now = Date.now() / 1000;
  const aud = Array.isArray(c.aud) ? c.aud.map(String) : [String(c.aud)];
  if (c.iss !== (cfg.issuer ?? TG_ISSUER)) throw new Error('jwt: издатель');
  if (!aud.includes(cfg.clientId)) throw new Error('jwt: получатель');
  if (typeof c.exp !== 'number' || c.exp < now - 60) throw new Error('jwt: истёк');
  if (c.nonce !== nonce) throw new Error('jwt: nonce');
  return c;
}

export async function finishLogin(cfg: TgLoginConfig, code: string, s: TgLoginState): Promise<TgIdentity> {
  const claims = await verifyIdToken(cfg, await exchangeCode(cfg, code, s.verifier), s.nonce);
  const id = Number(claims.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('jwt: нет Telegram ID (нужен scope profile)');
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const name = str(claims.name) ?? ([str(claims.given_name), str(claims.family_name)].filter(Boolean).join(' ') || null);
  return { id, username: str(claims.preferred_username)?.replace(/^@/, '') ?? null, name, picture: str(claims.picture) };
}
