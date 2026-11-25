import type { AgeBand, Category } from '../types';

/**
 * Built-in category hierarchy (Greek household budgeting). Ids are deterministic
 * (`seed:<key>`) so both phones seed identical rows and sync never duplicates them.
 * Category names are data (stored in the DB, editable/custom), not UI strings.
 */
interface SeedSub {
  key: string;
  el: string;
  en: string;
  icon: string;
  ageBand?: AgeBand;
}

interface SeedTop {
  key: string;
  el: string;
  en: string;
  icon: string;
  subs: SeedSub[];
}

export const SEED_CATEGORIES: SeedTop[] = [
  {
    key: 'housing', el: 'Στέγαση & Λογαριασμοί', en: 'Housing & Utilities', icon: 'house',
    subs: [
      { key: 'rent', el: 'Ενοίκιο / Δόση Δανείου', en: 'Rent / Mortgage', icon: 'key-round' },
      { key: 'utilities', el: 'Ρεύμα / Νερό / Θέρμανση', en: 'Electricity / Water / Heating', icon: 'zap' },
      { key: 'telecom', el: 'Τηλεφωνία & Internet', en: 'Phone & Internet', icon: 'wifi' },
      { key: 'building', el: 'Κοινόχρηστα', en: 'Building Maintenance / Shared Utilities', icon: 'building-2' },
    ],
  },
  {
    key: 'food', el: 'Διατροφή & Σπίτι', en: 'Food & Household', icon: 'shopping-cart',
    subs: [
      { key: 'supermarket', el: 'Σούπερ Μάρκετ', en: 'Supermarket', icon: 'shopping-basket' },
      { key: 'market', el: 'Λαϊκή / Κρεοπωλείο / Φούρνος', en: 'Farmers Market / Butcher / Bakery', icon: 'carrot' },
      { key: 'cleaning', el: 'Είδη καθαρισμού & προσωπικής φροντίδας', en: 'Cleaning & Personal Care', icon: 'spray-can' },
    ],
  },
  {
    key: 'transport', el: 'Μετακινήσεις', en: 'Transport', icon: 'car',
    subs: [
      { key: 'fuel', el: 'Καύσιμα / Εισιτήρια ΜΜΜ', en: 'Fuel / Public Transit', icon: 'fuel' },
      { key: 'car', el: 'Συντήρηση / Ασφάλεια / Τέλη ΙΧ', en: 'Car Maintenance / Insurance / Road Tax', icon: 'wrench' },
    ],
  },
  {
    key: 'children', el: 'Παιδιά & Εκπαίδευση', en: 'Children & Education', icon: 'baby',
    subs: [
      { key: 'diapers', el: 'Πάνες & Βρεφικά είδη', en: 'Diapers & Baby care', icon: 'baby', ageBand: '0-3' },
      { key: 'formula', el: 'Βρεφικό γάλα / τροφές', en: 'Formula / Baby food', icon: 'milk', ageBand: '0-3' },
      { key: 'daycare', el: 'Παιδικός Σταθμός', en: 'Daycare', icon: 'blocks', ageBand: '0-3' },
      { key: 'school', el: 'Σχολικά είδη', en: 'School supplies', icon: 'pencil', ageBand: '4-12' },
      { key: 'activities', el: 'Δραστηριότητες & Αθλήματα', en: 'Activities & Sports', icon: 'trophy', ageBand: '4-12' },
      { key: 'clothes', el: 'Ρούχα & Παπούτσια', en: 'Clothes & Shoes', icon: 'shirt', ageBand: '4-12' },
      { key: 'toys', el: 'Παιχνίδια', en: 'Toys', icon: 'puzzle', ageBand: '4-12' },
      { key: 'tutoring', el: 'Φροντιστήρια', en: 'Tutoring', icon: 'graduation-cap', ageBand: '13-18' },
      { key: 'pocket', el: 'Χαρτζιλίκι', en: 'Pocket money', icon: 'coins', ageBand: '13-18' },
      { key: 'clothesTech', el: 'Ρούχα & Τεχνολογία', en: 'Clothes & Tech', icon: 'smartphone', ageBand: '13-18' },
    ],
  },
  {
    key: 'health', el: 'Υγεία', en: 'Health', icon: 'heart-pulse',
    subs: [
      { key: 'doctors', el: 'Γιατροί', en: 'Doctors', icon: 'stethoscope' },
      { key: 'tests', el: 'Εξετάσεις', en: 'Medical Tests', icon: 'microscope' },
      { key: 'pharmacy', el: 'Φάρμακα', en: 'Pharmacy / Medicines', icon: 'pill' },
    ],
  },
  {
    key: 'leisure', el: 'Ψυχαγωγία & Λοιπά', en: 'Entertainment & Misc', icon: 'party-popper',
    subs: [
      { key: 'dining', el: 'Φαγητό έξω / Καφές / Delivery', en: 'Dining Out / Coffee / Delivery', icon: 'utensils' },
      { key: 'trips', el: 'Ταξίδια', en: 'Trips / Vacations', icon: 'plane' },
      { key: 'excursions', el: 'Εκδρομές', en: 'Excursions / Day Trips', icon: 'map' },
      { key: 'gifts', el: 'Δώρα & Έκτακτα', en: 'Gifts & Unexpected', icon: 'gift' },
    ],
  },
  {
    key: 'savings', el: 'Αποταμίευση', en: 'Savings', icon: 'piggy-bank',
    subs: [
      { key: 'emergency', el: 'Αποθεματικό έκτακτης ανάγκης', en: 'Emergency Fund', icon: 'shield' },
    ],
  },
];

export const SEED_DEVICE_ID = 'seed';

export const seedId = (key: string): string => `seed:${key}`;

/** Flatten the seed tree into Category rows. */
export function buildSeedCategories(): Category[] {
  const rows: Category[] = [];
  SEED_CATEGORIES.forEach((top, ti) => {
    const topId = seedId(top.key);
    rows.push({
      id: topId, parentId: null, seedKey: top.key, nameEl: top.el, nameEn: top.en, icon: top.icon,
      ageBand: null, enabled: true, sortOrder: ti * 100,
      updatedAt: 0, deletedAt: null, deviceId: SEED_DEVICE_ID,
    });
    top.subs.forEach((sub, si) => {
      const key = `${top.key}.${sub.key}`;
      rows.push({
        id: seedId(key), parentId: topId, seedKey: key, nameEl: sub.el, nameEn: sub.en, icon: sub.icon,
        ageBand: sub.ageBand ?? null, enabled: true, sortOrder: ti * 100 + si + 1,
        updatedAt: 0, deletedAt: null, deviceId: SEED_DEVICE_ID,
      });
    });
  });
  return rows;
}
