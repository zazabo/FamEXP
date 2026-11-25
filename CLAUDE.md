# CLAUDE.md — Project Instructions & Guardrails (v2.1)

> v2.1 (2026-11-24): variable per-month budget added.
> v2 (2026-11-24): stack changed from Expo/React Native to an installable PWA so both phones (Android + iPhone) run it for free. v1 is kept in `CLAUDE.v1.md`.

## 1. Project Identity & Core Philosophy
- **App Name:** Οικογενειακό Εξοδολόγιο / Family Expense Tracker (Parents-Only)
- **Platform:** Installable **PWA** (Progressive Web App) for iPhone (Safari → "Add to Home Screen") and Android (Chrome → "Install"). Hosted free on **GitHub Pages**. No App Store, no paid accounts.
- **Stack:** Vite + React + TypeScript (strict) + React Router (hash routing) + `vite-plugin-pwa`.
- **Design Ethos:** **Strict Minimalism.** Every screen must remain clean, fast, and clutter-free. Never add unnecessary fields, social features, ads, receipt OCR, or multi-currency bloat. A parent must be able to log an expense in under 3 seconds.

---

## 2. Coding & Architecture Standards
- **Language:** Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`). Avoid `any`; define clean interfaces in `src/types/`.
- **Directory Structure:**
  - `src/routes/` — screens (`TabsLayout`, `Dashboard`, `Analytics`, `Settings`, `Lock`, `Onboarding`, `AddExpense`).
  - `src/components/` — reusable, minimalist UI components.
  - `src/db/` — IndexedDB schema (Dexie), migrations, queries, category seed.
  - `src/i18n/` — `el.json` (default) and `en.json`, plus `format.ts` (money/dates).
  - `src/services/` — sync (Dropbox + encryption), PDF generator, Excel (`.xlsx`) builder, budget alerts.
  - `src/theme/` — Light & Dark colour tokens, typography, `ThemeProvider` / `useTheme()`.
- **Offline-First Rule:** All CRUD writes go to local IndexedDB first and the UI updates immediately (live queries). Sync runs asynchronously in the background and never blocks the user.
- **Versioning:** Semantic version in `package.json`, one minor version per phase (v0.1.0 … v0.6.0), every change recorded in `CHANGELOG.md`.

---

## 3. Data & Sync Rules
- **Shared records** (`familyMembers`, `categories`, `expenses`, `settings`, `budgets`) carry `id` (UUID), `updatedAt`, `deletedAt`, `deviceId`. Never hard-delete a shared record — soft-delete so the deletion reaches the other phone.
- **Device-only data** (`localSettings`: PIN hash, passkey id, Dropbox tokens, sync key, alert state, owner parent) is never synced. Language and theme live in `localStorage` (device-only).
- **Seeded categories** use deterministic ids (`seed:<key>`) and `updatedAt = 0` so both phones seed identical rows and any user edit wins.
- **Amounts** are integer cents. Children store **birth year**, not age.
- **Sync model (Dropbox, single shared account):** each phone writes only its own change file; it reads the other phone's file and merges per record (larger `updatedAt` wins; tombstones propagate). No file has two writers.
- **End-to-end encryption:** everything uploaded is encrypted on the phone with AES-256-GCM; the key is derived (PBKDF2-SHA-256, high iteration count) from a family passphrase entered once per phone. Dropbox, GitHub and anyone else only ever see ciphertext. Never upload plaintext, never log the passphrase or key.
- **Dropbox auth:** OAuth PKCE with **no redirect URI** (user copies the code shown by Dropbox into the app) — avoids iOS home-screen-app redirect problems. Tokens stay in `localSettings`.

---

## 4. Localization (i18n) Rules
- **Default Language:** Greek (`el`). Secondary: English (`en`), switchable in Settings.
- **Zero Hardcoded Strings:** Never hardcode visible UI text in components. Every label, button, alert, chart title, tooltip and PDF report string comes from `t('key')`. (Category names are data stored in the DB, in both languages.)
- **Currency:** Euro. Amounts always display Greek-style in both languages: `1.250,50 €` (`formatMoney`).

---

## 5. UI / UX & Theming Rules
- **Dark & Light Mode:** Every screen, modal, chart and icon consumes theme tokens (CSS variables from `src/theme/tokens.ts` / `useTheme()`). Never hardcode colours in components.
- **Touch Targets & Ergonomics:** Minimum 48px targets; the `+` button and numeric keypad reachable with one thumb; respect iPhone safe areas.
- **Hints:** Every field, toggle and value carries a `title` hint from i18n (shown on hover on desktop; harmless on touch).
- **Simplicity Check:** Expense form fields are strictly `Amount`, `Category/Subcategory`, `For Whom`, `Paid By`, `Date`, `Optional Short Note`.

---

## 6. Domain-Specific Rules
- **Parents-Only Access:** Lock on launch and when returning from background (`visibilitychange`). Unlock with a 4-digit PIN (stored only as a salted PBKDF2 hash) or a device passkey (WebAuthn → Face ID / fingerprint).
- **Dynamic Child Categories:** Age-banded subcategories under *Παιδιά & Εκπαίδευση* (*0–3*, *4–12*, *13–18*) are offered only while a child is in that band (computed from birth year); historical expenses are never deleted or re-categorised.
- **Category Integrity:** Always preserve the core Greek household hierarchy, including *Ταξίδια (Trips)* and *Εκδρομές (Excursions)* under *Ψυχαγωγία & Λοιπά*.
- **Variable Budget (user-chosen):** a default monthly budget (`settings.monthlyBudgetCents`, applies to every month) plus optional per-month overrides in `budgets` (id `YYYY-MM`; `amountCents: null` = no budget that month). Editable from the Dashboard budget card: this month only / all months / no budget / reset to default. Both are shared and synced.
- **Budget Notifications:** Check cumulative monthly spend against that month's effective budget after every local insert/edit/delete, budget change **and after every sync merge**. Notify once at **80%** and once at **100%** per `YYYY-MM` per device (in-app banner + system notification when permitted). Changing that month's budget re-arms the thresholds; deleting/undoing expenses does not. Web notifications only fire while the app is open — do not promise background alerts.
- **PDF & Excel Exports:** generated on the phone and handed to the native share sheet (Web Share API). PDFs use light, print-friendly styling regardless of the app theme. Excel columns: `Date`, `Category`, `Subcategory`, `For Whom`, `Paid By`, `Amount (€)`, `Note` — compatible with Excel and Google Sheets.

---

## 7. Security & Environment Hygiene
- Never commit tokens or secrets. Build-time config comes from `import.meta.env.VITE_*` and `.env.example` stays current. The Dropbox **app key** is public by design (PKCE, no secret) and may ship in the bundle.
- The GitHub Pages repo is public: it must contain code only — never data, exports, or `.env`.
- Handle Dropbox token expiry and offline states gracefully with clear, non-intrusive status in the Sync section.
