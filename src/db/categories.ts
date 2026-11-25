import type { AgeBand, Category, FamilyMember, Locale } from '../types';

/** Age a child turns during `year` (birth-year based, good enough for age bands). */
export function ageInYear(birthYear: number, year: number = new Date().getFullYear()): number {
  return year - birthYear;
}

export function ageBandFor(age: number): AgeBand | null {
  if (age < 0) return null;
  if (age <= 3) return '0-3';
  if (age <= 12) return '4-12';
  if (age <= 18) return '13-18';
  return null;
}

/** Age bands currently covered by at least one (non-deleted) child. */
export function activeAgeBands(members: FamilyMember[], year?: number): Set<AgeBand> {
  const bands = new Set<AgeBand>();
  for (const m of members) {
    if (m.role !== 'child' || m.deletedAt !== null || m.birthYear === null) continue;
    const band = ageBandFor(ageInYear(m.birthYear, year));
    if (band) bands.add(band);
  }
  return bands;
}

/**
 * Whether a category should be offered for new expenses. Age-banded child
 * subcategories hide automatically when no child is in that band; historical
 * expenses keep pointing at them (nothing is deleted).
 */
export function isSelectable(cat: Category, bands: Set<AgeBand>): boolean {
  if (cat.deletedAt !== null || !cat.enabled) return false;
  return cat.ageBand === null || bands.has(cat.ageBand);
}

export const categoryName = (cat: Pick<Category, 'nameEl' | 'nameEn'>, locale: Locale): string =>
  locale === 'en' ? cat.nameEn : cat.nameEl;
