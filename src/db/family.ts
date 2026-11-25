import { db } from './schema';
import { newSyncFields, touch, alive } from './repo';
import { setLocal } from './init';
import type { PinHash } from '../services/pin';
import { SHARED_SETTINGS_ID, type FamilyMember, type ParentSlot } from '../types';

export interface NewFamilyInput {
  parents: { slot: ParentSlot; name: string }[];
  children: { name: string; birthYear: number }[];
  ownerSlot: ParentSlot;
  monthlyBudgetCents: number | null;
  pinHash: PinHash;
  biometricCredentialId: string | null;
}

/**
 * First-run setup of a new family, written atomically: members and budget (shared, synced)
 * plus this phone's owner, PIN hash and passkey (device-only). The PIN hash is computed
 * before the transaction because IndexedDB transactions cannot wait on WebCrypto.
 */
export async function createFamily(input: NewFamilyInput): Promise<{ ownerParentId: string }> {
  const parents: FamilyMember[] = input.parents.map((p, i) => ({
    ...newSyncFields(), role: 'parent', name: p.name.trim(), parentSlot: p.slot, birthYear: null, sortOrder: i,
  }));
  const children: FamilyMember[] = input.children.map((c, i) => ({
    ...newSyncFields(), role: 'child', name: c.name.trim(), parentSlot: null, birthYear: c.birthYear, sortOrder: 10 + i,
  }));
  const owner = parents.find((p) => p.parentSlot === input.ownerSlot) ?? parents[0];
  if (!owner) throw new Error('At least one parent is required');

  await db.transaction('rw', [db.familyMembers, db.settings, db.localSettings], async () => {
    await db.familyMembers.bulkAdd([...parents, ...children]);
    const shared = await db.settings.get(SHARED_SETTINGS_ID);
    if (shared) await db.settings.put(touch({ ...shared, monthlyBudgetCents: input.monthlyBudgetCents }));
    await setLocal('ownerParentId', owner.id);
    await setLocal('pinHash', input.pinHash);
    await setLocal('pinAttempts', { failures: 0, lockedUntil: null });
    await setLocal('biometricCredentialId', input.biometricCredentialId);
    await setLocal('onboardingComplete', true);
  });
  return { ownerParentId: owner.id };
}

/** Members that are not soft-deleted, parents first, in display order. */
export async function listMembers(): Promise<FamilyMember[]> {
  return alive(await db.familyMembers.toArray()).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Second phone joining an existing family (data already merged from Dropbox): store which
 * parent owns this phone, its PIN hash and passkey, and mark setup complete — device-only.
 */
export async function completeJoin(input: { ownerParentId: string; pinHash: PinHash; biometricCredentialId: string | null }): Promise<void> {
  await db.transaction('rw', [db.localSettings], async () => {
    await setLocal('ownerParentId', input.ownerParentId);
    await setLocal('pinHash', input.pinHash);
    await setLocal('pinAttempts', { failures: 0, lockedUntil: null });
    await setLocal('biometricCredentialId', input.biometricCredentialId);
    await setLocal('autoSync', true);
    await setLocal('onboardingComplete', true);
  });
}
