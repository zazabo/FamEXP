import { fromBase64Url, randomBytes, toBase64Url } from './bytes';

/**
 * End-to-end encryption for everything that goes to Dropbox.
 * - Key: PBKDF2-SHA-256 (600,000 iterations) from the family passphrase + a random salt,
 *   giving a non-extractable AES-256-GCM key that never leaves the phone.
 * - Blob: "FEX1" | flags (1 byte) | IV (12 bytes) | AES-GCM ciphertext+tag.
 *   flags bit 0 = payload gzip-compressed. The file name is bound in as additional data,
 *   so a blob cannot be swapped for another device's file.
 */

const MAGIC = [0x46, 0x45, 0x58, 0x31]; // "FEX1"
const FLAG_GZIP = 1;
export const KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 8;
const CHECK_TEXT = 'famexp-family-check-v1';

export interface FamilyFile {
  app: 'famexp';
  v: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  /** Encrypted known text: lets a phone check a passphrase without touching real data. */
  check: string;
  createdAt: number;
}

const normalize = (passphrase: string): string => passphrase.trim().normalize('NFC');

export async function deriveFamilyKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalize(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function pipe(data: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canGzip = (): boolean => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function encryptBytes(key: CryptoKey, plain: Uint8Array<ArrayBuffer>, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  const gzip = canGzip();
  const payload = gzip ? await pipe(plain, new CompressionStream('gzip')) : plain;
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }, key, payload),
  );
  const out = new Uint8Array(4 + 1 + 12 + ct.length);
  out.set(MAGIC, 0);
  out[4] = gzip ? FLAG_GZIP : 0;
  out.set(iv, 5);
  out.set(ct, 17);
  return out;
}

/** Throws if the key is wrong, the data was altered, or the blob belongs to another file name. */
export async function decryptBytes(key: CryptoKey, blob: Uint8Array<ArrayBuffer>, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  if (blob.length < 17 || MAGIC.some((b, i) => blob[i] !== b)) throw new Error('Not an encrypted family file');
  const flags = blob[4]!;
  const iv = blob.slice(5, 17);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }, key, blob.slice(17)),
  );
  if (flags & FLAG_GZIP) {
    if (!canGzip()) throw new Error('This browser cannot decompress the sync data');
    return pipe(plain, new DecompressionStream('gzip'));
  }
  return plain;
}

export async function encryptJson(key: CryptoKey, value: unknown, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  return encryptBytes(key, new TextEncoder().encode(JSON.stringify(value)), aad);
}

export async function decryptJson<T>(key: CryptoKey, blob: Uint8Array<ArrayBuffer>, aad: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await decryptBytes(key, blob, aad))) as T;
}

/** First phone: new salt + key + check value. */
export async function createFamilyFile(passphrase: string): Promise<{ file: FamilyFile; key: CryptoKey }> {
  const salt = randomBytes(16);
  const key = await deriveFamilyKey(passphrase, salt, KDF_ITERATIONS);
  const check = await encryptBytes(key, new TextEncoder().encode(CHECK_TEXT), 'family.json');
  return {
    key,
    file: {
      app: 'famexp', v: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt: toBase64Url(salt) },
      check: toBase64Url(check),
      createdAt: Date.now(),
    },
  };
}

/** Other phone: derive the key from the passphrase and verify it; null if the passphrase is wrong. */
export async function unlockFamilyFile(file: FamilyFile, passphrase: string): Promise<CryptoKey | null> {
  const key = await deriveFamilyKey(passphrase, fromBase64Url(file.kdf.salt), file.kdf.iterations);
  try {
    const text = new TextDecoder().decode(await decryptBytes(key, fromBase64Url(file.check), 'family.json'));
    return text === CHECK_TEXT ? key : null;
  } catch {
    return null;
  }
}

export function isFamilyFile(value: unknown): value is FamilyFile {
  const f = value as Partial<FamilyFile> | null;
  return !!f && f.app === 'famexp' && f.v === 1 && typeof f.check === 'string' && typeof f.kdf?.salt === 'string'
    && typeof f.kdf.iterations === 'number';
}
