import Dexie, { type EntityTable } from 'dexie';
import type { Category, Expense, FamilyMember, LocalSetting, MonthBudget, SharedSettings, SyncState } from '../types';

export const DB_NAME = 'family-expenses';

/**
 * Local, offline-first store (IndexedDB). Every write lands here first and the UI
 * re-renders from it via live queries; cloud sync runs separately in the background.
 *
 * Migrations: add a new `this.version(n)` block — never edit a released one.
 */
export class AppDB extends Dexie {
  familyMembers!: EntityTable<FamilyMember, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  settings!: EntityTable<SharedSettings, 'id'>;
  budgets!: EntityTable<MonthBudget, 'id'>;
  localSettings!: EntityTable<LocalSetting, 'key'>;
  syncState!: EntityTable<SyncState, 'deviceId'>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      familyMembers: 'id, role, updatedAt',
      categories: 'id, parentId, updatedAt',
      expenses: 'id, date, categoryId, forWhomId, paidById, updatedAt',
      settings: 'id, updatedAt',
      localSettings: 'key',
      syncState: 'deviceId',
    });
    // v2 (app v0.3.0): per-month budget overrides.
    this.version(2).stores({
      budgets: 'id, updatedAt',
    });
  }
}

export const db = new AppDB();
