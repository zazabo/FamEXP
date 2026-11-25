# CLAUDE.md — Project Instructions & Guardrails (v1 — superseded by CLAUDE.md v2: PWA stack)

## 1. Project Identity & Core Philosophy
- **App Name:** Family Expense Tracker (Parents-Only)
- **Platforms:** iOS & Android (React Native + Expo + TypeScript + Expo Router)
- **Design Ethos:** **Strict Minimalism.** Every screen must remain clean, fast, and clutter-free. Never add unnecessary fields, social features, ads, receipt OCR, or multi-currency bloat. A parent must be able to log an expense in under 3 seconds.

---

## 2. Coding & Architecture Standards
- **Language:** Strict TypeScript (`strict: true`). Avoid `any`; define clean interfaces in `src/types/`.
- **Directory Structure:**
  - `app/` — Expo Router file-based navigation (`(tabs)/`, `onboarding.tsx`, `lock.tsx`, `add-expense.tsx`).
  - `src/components/` — Reusable, minimalist UI components.
  - `src/db/` — SQLite schema, migrations, queries, and category seeders.
  - `src/i18n/` — `el.json` (default) and `en.json` translation files.
  - `src/services/` — PDF generator, Excel (`.xlsx`) builder, Google Drive/Sheets sync, Dropbox sync.
  - `src/theme/` — Light & Dark mode color tokens and typography scales.
- **Offline-First Rule:** All CRUD operations MUST write to local `expo-sqlite` first and immediately update the UI. Cloud sync (Google Drive / Dropbox) must run asynchronously in the background without blocking user interactions.

---

## 3. Localization (i18n) Rules
- **Default Language:** Greek (`el`). Secondary: English (`en`).
- **Zero Hardcoded Strings:** Never hardcode visible UI text in components. Every label, button, alert, chart title, and PDF report string must come from `i18n` (`t('key')`).
- **Currency & Formatting:** Default currency is Euro (`€`). Format numbers cleanly according to locale (e.g., `125,50 €` in Greek).

---

## 4. UI / UX & Theming Rules
- **Dark & Light Mode:** Every screen, modal, chart, and icon must dynamically consume the active theme tokens (`useTheme()`). Never hardcode `#FFFFFF` or `#000000` backgrounds/text.
- **Touch Targets & Ergonomics:** Keep primary action buttons (especially the `+` Fast Entry button and numeric keypad) easily reachable with one thumb.
- **Simplicity Check:** Before adding any form field, verify it is strictly necessary (`Amount`, `Category/Subcategory`, `Member`, `Paid By`, `Date`, `Optional Short Note`).

---

## 5. Domain-Specific Rules
- **Parents-Only Access:** Enforce the Biometric (FaceID/Fingerprint) + 4-digit PIN lock on cold start and when returning from background (`AppState` listener). Store PIN only in `expo-secure-store`.
- **Dynamic Child Categories:** When children are added or their ages change in Settings, automatically update the visibility of age-appropriate subcategories under *Παιδιά & Εκπαίδευση* (*0–3*, *4–12*, *13–18*) without deleting historical expense records.
- **Category Integrity:** Always preserve the core Greek household category hierarchy, including *Ταξίδια (Trips)* and *Εκδρομές (Excursions)* under *Ψυχαγωγία & Λοιπά*.
- **Budget Notifications:** Check cumulative monthly spend on every expense insert/edit. Fire local notifications cleanly once when crossing **80%** and **100%** of the shared monthly budget (track alert state per `YYYY-MM` so the user isn't spammed repeatedly).
- **PDF & Excel Exports:**
  - PDF reports (Week/Month/Year) must render crisp HTML/SVG charts and summary tables readable in light print-friendly styling regardless of the app's current dark/light theme.
  - Excel exports must produce clean, well-labeled columns (`Date`, `Category`, `Subcategory`, `For Whom`, `Paid By`, `Amount (€)`, `Note`) compatible with both Excel and Google Sheets.

---

## 6. Security & Environment Hygiene
- Never commit API keys, OAuth Client IDs, or tokens to source control. Always read from `process.env.EXPO_PUBLIC_*` and keep `.env.example` updated.
- Handle OAuth token expiration and offline network states gracefully with clear, non-intrusive status indicators in the Sync tab.
