import { useLiveQuery } from 'dexie-react-hooks';
import type { TFunction } from 'i18next';
import { db } from '../db/schema';
import { listMembers } from '../db/family';
import { getOwnerParentId } from '../db/expenses';
import { activeAgeBands } from '../db/categories';
import { HOUSEHOLD_ID, type AgeBand, type Category, type FamilyMember } from '../types';

export interface FamilyData {
  members: FamilyMember[];
  /** Including removed members — for labels on older expenses. */
  allMembers: FamilyMember[];
  parents: FamilyMember[];
  children: FamilyMember[];
  categories: Category[];
  categoryById: Map<string, Category>;
  bands: Set<AgeBand>;
  ownerId: string | null;
}

/** Live family members, categories and this phone's owner — re-renders when any of them change. */
export function useFamilyData(): FamilyData | undefined {
  return useLiveQuery(async () => {
    const [members, allMembers, categories, ownerId] = await Promise.all([
      listMembers(), db.familyMembers.toArray(), db.categories.toArray(), getOwnerParentId(),
    ]);
    const parents = members.filter((m) => m.role === 'parent').sort((a, b) => (a.parentSlot ?? 0) - (b.parentSlot ?? 0));
    const children = members.filter((m) => m.role === 'child');
    return {
      members, allMembers, parents, children, categories,
      categoryById: new Map(categories.map((c) => [c.id, c])),
      bands: activeAgeBands(members),
      ownerId: ownerId ?? null,
    };
  }, []);
}

/** Display name for a "for whom" / "paid by" id. */
export function memberLabel(id: string, members: FamilyMember[], t: TFunction): string {
  if (id === HOUSEHOLD_ID) return t('members.household');
  return members.find((m) => m.id === id)?.name ?? '—';
}
