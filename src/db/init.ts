import { db } from './schema';
import { buildSeedCategories } from './seed';
import { SHARED_SETTINGS_ID, type LocalSettingKey, type SharedSettings } from '../types';

let cachedDeviceId: string | null = null;

/** This phone's stable id, used to stamp every change it makes. */
export function getDeviceId(): string {
  if (!cachedDeviceId) throw new Error('initDb() must run before getDeviceId()');
  return cachedDeviceId;
}

export async function getLocal<T>(key: LocalSettingKey): Promise<T | undefined> {
  const row = await db.localSettings.get(key);
  return row?.value as T | undefined;
}

export async function setLocal(key: LocalSettingKey, value: unknown): Promise<void> {
  await db.localSettings.put({ key, value });
}

/**
 * Open the database, create the device id on first run, and add any built-in
 * categories that are missing (existing rows — including user edits — are left alone).
 */
export async function initDb(): Promise<{ deviceId: string }> {
  await db.open();

  // Ask the browser not to evict our data under storage pressure (best effort).
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* not supported — home-screen apps are exempt from Safari's 7-day eviction anyway */
  }

  await db.transaction('rw', [db.localSettings, db.categories, db.settings], async () => {
    let deviceId = await getLocal<string>('deviceId');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      await setLocal('deviceId', deviceId);
    }
    cachedDeviceId = deviceId;

    const seed = buildSeedCategories();
    const existing = new Set(await db.categories.where('id').anyOf(seed.map((c) => c.id)).primaryKeys());
    const missing = seed.filter((c) => !existing.has(c.id));
    if (missing.length) await db.categories.bulkAdd(missing);

    if (!(await db.settings.get(SHARED_SETTINGS_ID))) {
      const shared: SharedSettings = {
        id: SHARED_SETTINGS_ID, monthlyBudgetCents: null,
        updatedAt: 0, deletedAt: null, deviceId: 'seed',
      };
      await db.settings.add(shared);
    }
  });

  return { deviceId: getDeviceId() };
}
