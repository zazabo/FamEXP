import type { Table } from 'dexie';
import { getDeviceId } from './init';
import { emitLocalChange } from '../services/syncBus';
import type { SyncFields } from '../types';

/** Sync fields for a brand-new record created on this phone (also schedules a background sync). */
export function newSyncFields(): SyncFields {
  emitLocalChange();
  return { id: crypto.randomUUID(), updatedAt: Date.now(), deletedAt: null, deviceId: getDeviceId() };
}

/** Stamp a change made on this phone (so it wins the per-record merge; also schedules a background sync). */
export function touch<T extends SyncFields>(row: T): T {
  emitLocalChange();
  return { ...row, updatedAt: Date.now(), deviceId: getDeviceId() };
}

/** Insert or update a shared record, stamping it as changed by this phone. */
export async function upsert<T extends SyncFields>(table: Table<T, string>, row: T): Promise<T> {
  const stamped = touch(row);
  await table.put(stamped);
  return stamped;
}

/** Soft-delete: keeps a tombstone so the deletion reaches the other phone. */
export async function softDelete<T extends SyncFields>(table: Table<T, string>, id: string): Promise<void> {
  const row = await table.get(id);
  if (!row || row.deletedAt) return;
  await table.put({ ...touch(row), deletedAt: Date.now() });
}

/** Rows that are not soft-deleted. */
export const alive = <T extends SyncFields>(rows: T[]): T[] => rows.filter((r) => r.deletedAt === null);
