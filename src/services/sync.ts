import type { Table } from 'dexie';
import { db } from '../db/schema';
import { getDeviceId, getLocal, setLocal } from '../db/init';
import { currentYearMonth, yearMonthOf } from '../db/dates';
import { createFamilyFile, decryptJson, encryptJson, isFamilyFile, MIN_PASSPHRASE_LENGTH, unlockFamilyFile, type FamilyFile } from './crypto';
import { DropboxError, download, listFolder, upload } from './dropbox';
import type { Expense, MonthBudget, SyncFields, YearMonth } from '../types';

/**
 * Two-phone sync through one shared Dropbox app folder:
 *   /family.json            salt + key check (no data)
 *   /devices/<deviceId>.fex this phone's encrypted snapshot of every shared record
 * Each phone writes only its own file (no write conflicts) and merges the other phone's
 * file record by record: the larger `updatedAt` wins (ties → larger deviceId), deletions
 * travel as tombstones. Every snapshot is a full copy, so either file alone can restore all.
 */

const FAMILY_PATH = '/family.json';
const DEVICES_DIR = '/devices';
const SNAPSHOT_VERSION = 1;

const SHARED = ['familyMembers', 'categories', 'expenses', 'settings', 'budgets'] as const;
type SharedTable = (typeof SHARED)[number];

interface Snapshot {
  app: 'famexp';
  v: number;
  deviceId: string;
  exportedAt: number;
  records: Partial<Record<SharedTable, SyncFields[]>>;
}

export type SyncErrorKind = 'offline' | 'auth' | 'nokey' | 'nofamily' | 'badkey' | 'other';

export class SyncError extends Error {
  constructor(public kind: SyncErrorKind, message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface SyncResult {
  merged: number;
  uploaded: boolean;
  /** Months whose expenses or budget changed through the merge (re-check alerts). */
  changedMonths: YearMonth[];
}

const table = (name: SharedTable): Table<SyncFields, string> => db[name] as unknown as Table<SyncFields, string>;
const ownFileName = (): string => `${getDeviceId()}.fex`;

function toSyncError(err: unknown): SyncError {
  if (err instanceof SyncError) return err;
  if (err instanceof DropboxError) return new SyncError(err.kind === 'offline' ? 'offline' : err.kind === 'auth' ? 'auth' : 'other', err.message);
  return new SyncError('other', err instanceof Error ? err.message : String(err));
}

// ---------------------------------------------------------------- family key

export async function fetchFamilyFile(): Promise<FamilyFile | null> {
  try {
    const bytes = await download(FAMILY_PATH);
    if (!bytes) return null;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isFamilyFile(parsed)) throw new SyncError('other', 'family.json is not a FamEXP family file');
    return parsed;
  } catch (err) {
    throw toSyncError(err);
  }
}

export async function hasFamilyKey(): Promise<boolean> {
  return Boolean(await getLocal<CryptoKey | null>('syncKey'));
}

export type KeySetupResult = 'created' | 'joined';

/**
 * Set up the family key on this phone.
 * - `create`: only if Dropbox has no family yet (first phone).
 * - `join`: the family must exist; the passphrase must match.
 */
export async function setupFamilyKey(passphrase: string, mode: 'create' | 'join'): Promise<KeySetupResult> {
  if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) throw new SyncError('badkey', 'Passphrase too short');
  try {
    const existing = await fetchFamilyFile();
    if (mode === 'create') {
      if (existing) throw new SyncError('other', 'A family already exists in this Dropbox');
      const { file, key } = await createFamilyFile(passphrase);
      await upload(FAMILY_PATH, new TextEncoder().encode(JSON.stringify(file, null, 2)));
      await setLocal('syncKey', key);
      return 'created';
    }
    if (!existing) throw new SyncError('nofamily', 'No family in this Dropbox yet');
    const key = await unlockFamilyFile(existing, passphrase);
    if (!key) throw new SyncError('badkey', 'Wrong passphrase');
    await setLocal('syncKey', key);
    return 'joined';
  } catch (err) {
    throw toSyncError(err);
  }
}

/** Forget the key and sync bookkeeping on this phone (local data is kept). */
export async function resetSyncState(): Promise<void> {
  await setLocal('syncKey', null);
  await setLocal('lastUploadedAt', null);
  await setLocal('lastSyncedAt', null);
  await db.syncState.clear();
}

// ---------------------------------------------------------------- snapshot & merge

async function exportSnapshot(): Promise<Snapshot> {
  const records: Snapshot['records'] = {};
  for (const name of SHARED) {
    // Rows never changed by anyone (pristine seed, updatedAt 0) are identical on both phones.
    records[name] = await table(name).where('updatedAt').above(0).toArray();
  }
  return { app: 'famexp', v: SNAPSHOT_VERSION, deviceId: getDeviceId(), exportedAt: Date.now(), records };
}

const isRecord = (r: unknown): r is SyncFields => {
  const x = r as Partial<SyncFields> | null;
  return !!x && typeof x.id === 'string' && typeof x.updatedAt === 'number' && typeof x.deviceId === 'string'
    && (x.deletedAt === null || typeof x.deletedAt === 'number');
};

const wins = (incoming: SyncFields, local: SyncFields | undefined): boolean =>
  !local || incoming.updatedAt > local.updatedAt || (incoming.updatedAt === local.updatedAt && incoming.deviceId > local.deviceId);

/** Merge a remote snapshot into the local DB (one transaction). Exported for tests. */
export async function mergeSnapshot(snapshot: Snapshot): Promise<{ merged: number; changedMonths: Set<YearMonth> }> {
  const changedMonths = new Set<YearMonth>();
  let merged = 0;
  await db.transaction('rw', SHARED.map((n) => table(n)), async () => {
    for (const name of SHARED) {
      const incoming = (snapshot.records[name] ?? []).filter(isRecord);
      if (!incoming.length) continue;
      const t = table(name);
      const locals = await t.bulkGet(incoming.map((r) => r.id));
      const toPut: SyncFields[] = [];
      incoming.forEach((row, i) => {
        const local = locals[i];
        if (!wins(row, local)) return;
        toPut.push(row);
        if (name === 'expenses') {
          changedMonths.add(yearMonthOf((row as Expense).date));
          if (local) changedMonths.add(yearMonthOf((local as Expense).date));
        } else if (name === 'budgets') {
          changedMonths.add((row as MonthBudget).id);
        } else if (name === 'settings') {
          changedMonths.add(currentYearMonth()); // default budget changed
        }
      });
      if (toPut.length) await t.bulkPut(toPut);
      merged += toPut.length;
    }
  });
  return { merged, changedMonths };
}

async function hasLocalChanges(since: number): Promise<boolean> {
  const me = getDeviceId();
  for (const name of SHARED) {
    const n = await table(name).where('updatedAt').above(since).filter((r) => r.deviceId === me).count();
    if (n > 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------- sync run

let running: Promise<SyncResult> | null = null;

/** Download + merge the other phone's file, then upload ours if needed. Serialised. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = runSync().finally(() => { running = null; });
  return running;
}

async function runSync(): Promise<SyncResult> {
  const key = await getLocal<CryptoKey | null>('syncKey');
  if (!key) throw new SyncError('nokey', 'Family passphrase not set on this phone');
  try {
    const own = ownFileName();
    const entries = await listFolder(DEVICES_DIR);
    let merged = 0;
    const months = new Set<YearMonth>();

    for (const entry of entries) {
      if (entry.name === own || !entry.name.endsWith('.fex')) continue;
      const remoteId = entry.name.slice(0, -4);
      const state = await db.syncState.get(remoteId);
      if (state?.lastRev === entry.rev) continue; // unchanged since last merge
      const bytes = await download(entry.path);
      if (!bytes) continue;
      let snapshot: Snapshot;
      try {
        snapshot = await decryptJson<Snapshot>(key, bytes, entry.name);
      } catch {
        throw new SyncError('badkey', `Cannot decrypt ${entry.name}`);
      }
      if (snapshot.app !== 'famexp') continue;
      const res = await mergeSnapshot(snapshot);
      merged += res.merged;
      res.changedMonths.forEach((m) => months.add(m));
      await db.syncState.put({ deviceId: remoteId, lastRev: entry.rev, lastMergedAt: Date.now() });
    }

    const ownExists = entries.some((e) => e.name === own);
    const lastUploadedAt = (await getLocal<number | null>('lastUploadedAt')) ?? 0;
    let uploaded = false;
    if (!ownExists || (await hasLocalChanges(lastUploadedAt))) {
      const startedAt = Date.now();
      const blob = await encryptJson(key, await exportSnapshot(), own);
      await upload(`${DEVICES_DIR}/${own}`, blob);
      await setLocal('lastUploadedAt', startedAt);
      uploaded = true;
    }

    await setLocal('lastSyncedAt', Date.now());
    return { merged, uploaded, changedMonths: [...months] };
  } catch (err) {
    throw toSyncError(err);
  }
}
