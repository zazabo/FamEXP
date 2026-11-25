import { DROPBOX_APP_KEY } from '../config';
import { getLocal, setLocal } from '../db/init';
import { randomBytes, toBase64Url } from './bytes';

/**
 * Minimal Dropbox API v2 client for an "App folder" app, straight from the browser.
 * Auth: OAuth 2 PKCE **without a redirect URI** — Dropbox shows a code the parent copies
 * into the app (avoids iOS home-screen redirect problems). Offline access gives a refresh
 * token; short-lived access tokens are renewed automatically. Tokens stay on this phone.
 */

export interface DropboxAuth {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
  refreshToken: string;
  accountId: string | null;
}

interface PendingAuth {
  verifier: string;
  createdAt: number;
}

export type DropboxErrorKind = 'offline' | 'auth' | 'notfound' | 'other';

export class DropboxError extends Error {
  constructor(public kind: DropboxErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'DropboxError';
  }
}

export interface DropboxEntry {
  name: string;
  path: string;
  rev: string;
  serverModified: string;
}

const API = 'https://api.dropboxapi.com';
const CONTENT = 'https://content.dropboxapi.com';

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new DropboxError('offline', 'Network unavailable');
  }
}

async function sha256Base64Url(text: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

/**
 * Step 1: the Dropbox authorization page URL (opened in a new tab/Safari). Reuses a pending
 * verifier younger than an hour, so the link stays valid if the app was closed meanwhile.
 */
export async function startAuth(): Promise<string> {
  const pending = await getLocal<PendingAuth | null>('dropboxPkce');
  let verifier = pending && Date.now() - pending.createdAt < 3_600_000 ? pending.verifier : null;
  if (!verifier) {
    verifier = toBase64Url(randomBytes(48));
    await setLocal('dropboxPkce', { verifier, createdAt: Date.now() } satisfies PendingAuth);
  }
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export async function hasPendingAuth(): Promise<boolean> {
  return Boolean(await getLocal<PendingAuth | null>('dropboxPkce'));
}

/** Step 2: exchange the code the parent pasted for tokens. */
export async function finishAuth(code: string): Promise<void> {
  const pending = await getLocal<PendingAuth | null>('dropboxPkce');
  if (!pending) throw new DropboxError('auth', 'No authorization in progress');
  const res = await call(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code.trim(), grant_type: 'authorization_code', client_id: DROPBOX_APP_KEY, code_verifier: pending.verifier,
    }),
  });
  if (!res.ok) throw new DropboxError(res.status === 400 ? 'auth' : 'other', 'Code rejected', res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number; refresh_token: string; account_id?: string };
  await setLocal('dropboxAuth', {
    accessToken: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in) * 1000,
    refreshToken: json.refresh_token,
    accountId: json.account_id ?? null,
  } satisfies DropboxAuth);
  await setLocal('dropboxPkce', null);
}

export async function isConnected(): Promise<boolean> {
  return Boolean(await getLocal<DropboxAuth | null>('dropboxAuth'));
}

async function refresh(auth: DropboxAuth): Promise<DropboxAuth> {
  const res = await call(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refreshToken, client_id: DROPBOX_APP_KEY }),
  });
  if (!res.ok) throw new DropboxError(res.status === 400 || res.status === 401 ? 'auth' : 'other', 'Refresh failed', res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  const next = { ...auth, accessToken: json.access_token, expiresAt: Date.now() + Number(json.expires_in) * 1000 };
  await setLocal('dropboxAuth', next);
  return next;
}

async function accessToken(forceRefresh = false): Promise<string> {
  let auth = await getLocal<DropboxAuth | null>('dropboxAuth');
  if (!auth) throw new DropboxError('auth', 'Not connected');
  if (forceRefresh || auth.expiresAt - Date.now() < 60_000) auth = await refresh(auth);
  return auth.accessToken;
}

/** Send an authorised request; on an expired token refresh once and retry. */
async function authed(url: string, init: (token: string) => RequestInit): Promise<Response> {
  let res = await call(url, init(await accessToken()));
  if (res.status === 401) res = await call(url, init(await accessToken(true)));
  if (res.status === 401) throw new DropboxError('auth', 'Unauthorized', 401);
  return res;
}

async function failure(res: Response): Promise<DropboxError> {
  const text = await res.text().catch(() => '');
  if (res.status === 409 && /not_found/.test(text)) return new DropboxError('notfound', text, 409);
  return new DropboxError('other', text || res.statusText, res.status);
}

async function rpc<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await authed(`${API}/2/${endpoint}`, (token) => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

interface ListResult {
  entries: { '.tag': string; name: string; path_display: string; rev?: string; server_modified?: string }[];
  cursor: string;
  has_more: boolean;
}

/** Files in an app-folder path ("" is the root). Missing folder → empty list. */
export async function listFolder(path: string): Promise<DropboxEntry[]> {
  const out: DropboxEntry[] = [];
  try {
    let page = await rpc<ListResult>('files/list_folder', { path });
    for (;;) {
      for (const e of page.entries) {
        if (e['.tag'] === 'file' && e.rev) out.push({ name: e.name, path: e.path_display, rev: e.rev, serverModified: e.server_modified ?? '' });
      }
      if (!page.has_more) break;
      page = await rpc<ListResult>('files/list_folder/continue', { cursor: page.cursor });
    }
  } catch (err) {
    if (err instanceof DropboxError && err.kind === 'notfound') return [];
    throw err;
  }
  return out;
}

/** File bytes, or null if the file does not exist. */
export async function download(path: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const res = await authed(`${CONTENT}/2/files/download`, (token) => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path }) },
  }));
  if (!res.ok) {
    const err = await failure(res);
    if (err.kind === 'notfound') return null;
    throw err;
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function upload(path: string, bytes: Uint8Array<ArrayBuffer>): Promise<{ rev: string }> {
  const res = await authed(`${CONTENT}/2/files/upload`, (token) => ({
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true }),
    },
    body: bytes,
  }));
  if (!res.ok) throw await failure(res);
  const json = (await res.json()) as { rev: string };
  return { rev: json.rev };
}

/** Forget the Dropbox connection on this phone (and revoke the token, best effort). */
export async function disconnect(): Promise<void> {
  try {
    const auth = await getLocal<DropboxAuth | null>('dropboxAuth');
    if (auth) {
      await fetch(`${API}/2/auth/token/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${auth.accessToken}` } });
    }
  } catch {
    /* offline — the local tokens are removed anyway */
  }
  await setLocal('dropboxAuth', null);
  await setLocal('dropboxPkce', null);
}
