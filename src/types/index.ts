/** Calendar date without time, `YYYY-MM-DD` (local). */
export type ISODate = string;
/** Calendar month, `YYYY-MM`. */
export type YearMonth = string;

export type Locale = 'el' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Fields carried by every record that is shared between the two phones.
 * Merge rule (Phase 4): per record id, the copy with the larger `updatedAt` wins;
 * deletes are soft (`deletedAt` set) so they propagate to the other phone.
 */
export interface SyncFields {
  id: string;
  /** Epoch ms of the last local change. Seeded rows use 0 so any user edit wins. */
  updatedAt: number;
  /** Epoch ms when soft-deleted, otherwise null. */
  deletedAt: number | null;
  /** Device that made the last change (`seed` for built-in rows). */
  deviceId: string;
}

export type MemberRole = 'parent' | 'child';
export type ParentSlot = 1 | 2;

export interface FamilyMember extends SyncFields {
  role: MemberRole;
  name: string;
  /** Parents only: which parent this is (Γονέας 1 / Γονέας 2). */
  parentSlot: ParentSlot | null;
  /** Children only. Stored instead of age so age bands advance automatically. */
  birthYear: number | null;
  sortOrder: number;
}

/** Pseudo-member used for household / shared expenses (Σπίτι / Κοινό). Not stored. */
export const HOUSEHOLD_ID = 'household';

export type AgeBand = '0-3' | '4-12' | '13-18';

export interface Category extends SyncFields {
  /** null for a top-level category, otherwise the parent category id. */
  parentId: string | null;
  /** Stable seed key (e.g. `housing.rent`); null for user-created categories. */
  seedKey: string | null;
  nameEl: string;
  nameEn: string;
  /** lucide-react icon name (kebab-case). */
  icon: string;
  /** Child subcategories only: shown while at least one child is in this band. */
  ageBand: AgeBand | null;
  enabled: boolean;
  sortOrder: number;
}

export interface Expense extends SyncFields {
  /** Amount in euro cents (integer) to avoid floating-point rounding. */
  amountCents: number;
  /** Leaf (sub)category id. */
  categoryId: string;
  /** Family member id, or HOUSEHOLD_ID. */
  forWhomId: string;
  /** Parent member id. */
  paidById: string;
  date: ISODate;
  note: string;
  createdAt: number;
}

/** Shared (synced) settings — a single row with id `shared`. */
export interface SharedSettings extends SyncFields {
  /** Total monthly household budget in cents; null = no budget set. */
  monthlyBudgetCents: number | null;
}

export const SHARED_SETTINGS_ID = 'shared';

/**
 * Per-month budget override (shared, synced). `id` is the month `YYYY-MM`.
 * `amountCents: null` means "no budget for this month". When no (live) override exists,
 * the default `SharedSettings.monthlyBudgetCents` applies.
 */
export interface MonthBudget extends SyncFields {
  amountCents: number | null;
}

export type BudgetSource = 'month' | 'default';

export interface EffectiveBudget {
  cents: number | null;
  source: BudgetSource;
}

/** Device-only key/value settings — never synced. */
export interface LocalSetting {
  key: LocalSettingKey;
  value: unknown;
}

export type LocalSettingKey =
  | 'deviceId'
  | 'onboardingComplete'
  | 'ownerParentId'
  | 'pinHash'
  | 'pinAttempts'
  | 'biometricCredentialId'
  | 'budgetAlerts'
  | 'dropboxAuth'
  | 'dropboxPkce'
  | 'syncKey'
  | 'autoSync'
  | 'lastSyncedAt'
  | 'lastUploadedAt';

/** Per-remote-device sync bookkeeping (Phase 4). */
export interface SyncState {
  deviceId: string;
  /** Dropbox revision of that device's change file we last merged. */
  lastRev: string | null;
  lastMergedAt: number | null;
}
