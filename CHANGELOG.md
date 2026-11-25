# Changelog

All notable changes to this project. Versions follow [Semantic Versioning](https://semver.org/); one minor version per build phase.

## [0.6.0] — 2026-11-25 — Phase 6: Excel export & polish

### Added
- **Settings → Export → Excel (.xlsx)** for one year or all years: a *Summary* sheet (per month: total, budget, difference, count, amount per category, totals row) and one sheet per month with `Date`, `Category`, `Subcategory`, `For Whom`, `Paid By`, `Amount (€)`, `Note` — real dates and numbers, frozen header row, column widths; opens in Excel and Google Sheets. Generated on the phone (write-excel-file, loaded on demand) and handed to the share sheet.

### Changed
- Faster start and cheaper updates: Settings and the first-run setup now load on demand; framework code (React, router, Dexie/i18next) lives in separate long-lived chunks, so an app update re-downloads only ~33 KB (gzip) of app code.
- README, `SETUP-el.md` and `CLAUDE.md` (v2.2) updated for the finished feature set.

## [0.5.1] — 2026-11-25 — Dropbox connection messages & "Paid by"

### Added
- **Paid by** line in Analytics and in the PDF summary: how much each parent paid in the period.
- Dropbox connection: when a code is refused, the app now says why — expired/already used, created on another device, or the Dropbox app does not allow PKCE (with the exact setting to change) — and shows Dropbox's own reply.

### Fixed
- Pasted Dropbox codes are cleaned (spaces, quotes, dots, line breaks removed).
- After a refused code the app starts a fresh authorization (new link + verifier), so one failure no longer blocks the next attempts.

## [0.5.0] — 2026-11-25 — Phase 5: analytics & PDF reports

### Added
- **Analytics tab**: Week (Monday–Sunday) / Month / Year with previous, next and "Current" navigation (period kept in the URL).
- Summary: total, number of expenses, daily average over the elapsed days, budget vs actual (month: that month's budget; year: sum of the months' budgets; week: explained as monthly).
- Trend bar chart (per day / calendar week / month) with tap-or-hover tooltip; the year view shows each month's budget as a dashed line.
- Donut + ranked bars **by category** (tap to see subcategories) and **by family member** (household, each parent, each child; more than 7 fold into "Others"). Colour follows the category/member, never its rank; palette validated for colour-blind readers on both themes.
- **PDF report** (A4, light print styling): summary, budget vs actual, vector trend chart, category donut + table with subcategories, per-member (per-child) donut + table, page footer. Generated on the phone with an embedded Greek font and handed to the share sheet (download on desktop; a "Share PDF" button if the browser needs a fresh tap).
- `analytics.ts` aggregation shared by the screen and the PDF.

### Changed
- Analytics and the PDF code are lazy-loaded; jsPDF's unused HTML/SVG helpers are excluded from the offline cache; fonts are cached for offline PDF export.
- `SETUP-el.md`: the deploy workflow is already in the repository.

## [0.4.0] — 2026-11-24 — Phase 4: encrypted Dropbox sync, family settings, GitHub Pages

### Added
- **Two-phone sync through one Dropbox account** (app "FamEXP", App folder). OAuth 2 PKCE without redirect URI (copy-paste code), offline refresh token, automatic token renewal.
- **End-to-end encryption**: family passphrase → PBKDF2-SHA-256 (600,000 iterations) → non-extractable AES-256-GCM key kept on the phone; Dropbox holds only `family.json` (salt + passphrase check) and one encrypted, gzip-compressed snapshot per phone (`devices/<id>.fex`, file name bound as additional data).
- Merge engine: each phone writes only its own file and merges the other's record by record (latest `updatedAt` wins, deterministic tie-break, tombstones propagate deletions); unchanged remote files are skipped by revision.
- Background sync: on unlock, on return to the app, when back online, every minute while open and ~3 s after each local change; budget alerts re-checked for months changed by the merge; "N changes arrived" message on manual sync.
- **Join an existing family** (second phone): Dropbox → family passphrase → download → choose which parent owns the phone → PIN / Face ID. Resumes if the app was closed while copying the Dropbox code.
- Settings → Sync: connect, set/enter family passphrase, status (last sync, offline, expired login, wrong key), Sync now, auto-sync switch, disconnect, reconnect.
- Settings → Family & Budget: edit parent names (auto-save), add a second parent, add/remove children (removed children keep their name on past expenses), birth years, owner of this phone, default monthly budget.
- GitHub Pages deployment workflow (`setup/deploy.yml` → move to `.github/workflows/deploy.yml`; base `/FamEXP/`), Greek setup guide `SETUP-el.md`.

### Changed
- Every local change to shared data now signals the background sync (via `newSyncFields` / `touch`).
- `.env.example` carries the public FamEXP app key; `.gitignore` excludes `Claude outputs/`.

## [0.3.0] — 2026-11-24 — Phase 3: dashboard, fast entry, variable budget & alerts

### Added
- Fast-entry form (`+`): auto-focused amount, two-level icon category picker with a "Recent" row (last 6 subcategories, one tap), For whom pills (Household + parents + children), Paid by (defaults to this phone's owner; hidden for single-parent families), date (default today), optional 60-char note.
- Child subcategories offered only for the children's current age bands; an expense keeps its category when edited even if the band has passed.
- Edit screen (`#/expense/:id`) with delete.
- Dashboard: month switcher (remembered in the URL), budget card with spent / budget, remaining or "over by", colour-coded bar (green < 80 %, amber 80–99 %, red ≥ 100 %) and expense count; this month's expenses with category icon, subcategory, date · note, member pill, payer initial and amount.
- Swipe left to delete, with a 5-second Undo (soft delete, syncs later); tap to edit; keyboard support (Enter / Delete).
- **Variable, user-chosen budget** (requested): tap the budget card to set an amount for this month only or as the default for all months, remove the limit, or reset a month to the default. New synced `budgets` table (IndexedDB schema v2).
- Budget alerts at 80 % and 100 %: in-app banner + system notification (permission asked on the first save once a budget exists), once per month per phone; re-armed when that month's budget changes, never repeated by delete + undo.
- Toast messages (saved / deleted + Undo / budget alerts).

### Changed
- `CLAUDE.md` → v2.1 (variable budget and alert rules).

## [0.2.0] — 2026-11-24 — Phase 2: lock screen & onboarding

### Added
- First-run onboarding: "New family" in 3 steps — parents (parent 2 optional) and which parent owns this phone; children (0–12) with name and birth year; 4-digit PIN with confirmation, optional Face ID / fingerprint, optional monthly budget. Everything is written in one transaction.
- "Join an existing family" entry shown but disabled until Dropbox sync (Phase 4).
- Lock screen on cold start and whenever the app goes to the background (also hides data in the app-switcher preview). Returns to the screen that was open after unlocking.
- PIN stored only as a salted PBKDF2-SHA-256 hash (150,000 iterations), on this phone only. 5 wrong PINs lock the keypad for 30 s; the lockout survives a reload.
- Face ID / fingerprint through a device passkey (WebAuthn, platform authenticator, user verification required); the PIN always remains as fallback.
- Settings → Security: change PIN (current → new → confirm) and turn Face ID / fingerprint on or off.
- Thumb-friendly PIN keypad (also works with a physical keyboard), on/off switch component, form styles.
- "Forgot PIN?" explanation on the lock screen.

### Changed
- Route guards: all screens with family data require a finished onboarding and an unlocked session.

## [0.1.0] — 2026-11-24 — Phase 1: project foundation

### Added
- Vite + React + TypeScript (strict) project, installable as a PWA (manifest, offline service worker, auto-update), icons.
- Configurable base path (`VITE_BASE`) for GitHub Pages; hash routing so deep links work there.
- Data model in `src/types/` with sync fields (`id`, `updatedAt`, `deletedAt`, `deviceId`) on every shared record.
- IndexedDB schema (Dexie) — `familyMembers`, `categories`, `expenses`, `settings` (shared) and `localSettings`, `syncState` (device-only).
- Seed of the bilingual Greek/English category hierarchy (7 categories, 27 subcategories) with deterministic ids and age bands 0–3 / 4–12 / 13–18 for child subcategories; age-band visibility helpers.
- i18n with Greek as default and English as secondary (`el.json`, `en.json`); money formatting `1.250,50 €` in both languages; amount parsing to integer cents.
- Theme system: Light / Dark / System with colour tokens as CSS variables and `useTheme()`.
- Screen skeleton: Dashboard (month switcher, `+` button), Analytics, Settings (working language & theme switches, version/diagnostics), Lock, Onboarding, New Expense.
- `CLAUDE.md` v2 (PWA stack, sync & encryption rules); previous version kept as `CLAUDE.v1.md`.
