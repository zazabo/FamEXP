import { getLocal, setLocal } from '../db/init';
import { constantTimeEqual, fromBase64Url, randomBytes, toBase64Url } from './bytes';

/**
 * The 4-digit PIN is never stored — only a salted PBKDF2-SHA-256 hash, on this phone only.
 * (It is a lock against children, not an encryption key.)
 */
export interface PinHash {
  v: 1;
  salt: string;
  hash: string;
  iterations: number;
}

export interface PinAttempts {
  failures: number;
  lockedUntil: number | null;
}

export type PinCheck =
  | { ok: true }
  | { ok: false; remaining: number; lockedUntil: number | null };

const ITERATIONS = 150_000;
export const PIN_LENGTH = 4;
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;

export const isValidPin = (pin: string): boolean => /^\d{4}$/.test(pin);

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function createPinHash(pin: string): Promise<PinHash> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 digits');
  const salt = randomBytes(16);
  const hash = await derive(pin, salt, ITERATIONS);
  return { v: 1, salt: toBase64Url(salt), hash: toBase64Url(hash), iterations: ITERATIONS };
}

export async function verifyPinHash(pin: string, stored: PinHash): Promise<boolean> {
  const hash = await derive(pin, fromBase64Url(stored.salt), stored.iterations);
  return constantTimeEqual(hash, fromBase64Url(stored.hash));
}

export async function getPinAttempts(): Promise<PinAttempts> {
  return (await getLocal<PinAttempts>('pinAttempts')) ?? { failures: 0, lockedUntil: null };
}

/**
 * Check a PIN against the stored hash, counting failures. After MAX_ATTEMPTS wrong
 * PINs the keypad is locked for LOCKOUT_MS (persisted, so reloading does not reset it).
 */
export async function checkPin(pin: string, now: number = Date.now()): Promise<PinCheck> {
  const attempts = await getPinAttempts();
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return { ok: false, remaining: 0, lockedUntil: attempts.lockedUntil };
  }
  const stored = await getLocal<PinHash>('pinHash');
  if (stored && (await verifyPinHash(pin, stored))) {
    await setLocal('pinAttempts', { failures: 0, lockedUntil: null } satisfies PinAttempts);
    return { ok: true };
  }
  // A finished lockout starts a fresh round of attempts.
  const failures = (attempts.lockedUntil ? 0 : attempts.failures) + 1;
  const lockedUntil = failures >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null;
  await setLocal('pinAttempts', { failures: lockedUntil ? 0 : failures, lockedUntil } satisfies PinAttempts);
  return { ok: false, remaining: lockedUntil ? 0 : MAX_ATTEMPTS - failures, lockedUntil };
}

export async function savePin(pin: string): Promise<void> {
  await setLocal('pinHash', await createPinHash(pin));
  await setLocal('pinAttempts', { failures: 0, lockedUntil: null } satisfies PinAttempts);
}
