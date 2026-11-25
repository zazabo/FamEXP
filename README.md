# Οικογενειακό Εξοδολόγιο (Family Expense Tracker) — v0.4.0

Minimalist, bilingual (Greek / English) expense tracker for two parents. It runs as an installable web app (PWA) on both iPhone and Android, for free, with encrypted sync through Dropbox.

> **Status:** Phase 4 of 6 — encrypted Dropbox sync, family settings, GitHub Pages.
>
> **Οδηγός εγκατάστασης στα ελληνικά: [SETUP-el.md](SETUP-el.md)** (Dropbox, GitHub Pages, κινητά). Changes: `CHANGELOG.md`.

## Requirements

- Node.js 22+ and npm.
- To publish: a free GitHub account. For sync: a Dropbox account (both phones use the same one).

## Run locally

```bash
npm install
npm run dev        # opens http://localhost:5173
```

To try it on a phone on the same Wi-Fi: `npm run dev -- --host` and open the "Network" address it prints. (Installing to the home screen and the service worker need HTTPS, so do the real install from GitHub Pages.)

Other scripts:

```bash
npm run typecheck  # TypeScript strict check
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

## Configuration

Copy `.env.example` to `.env` and fill in values when they are needed:

| Variable | Used from | Meaning |
|---|---|---|
| `VITE_BASE` | Phase 1 | Base path. `/` locally; `/<repo-name>/` on GitHub Pages. |
| `VITE_DROPBOX_APP_KEY` | Phase 4 | App key of your Dropbox app (public, no secret). |

## Publish & install

- Live URL: **https://zazabo.github.io/FamEXP/** — built and deployed by `.github/workflows/deploy.yml` (copy of `setup/deploy.yml` — move it there) on every push to `main` (repo Settings → Pages → Source: *GitHub Actions*).
- **iPhone:** open the link in **Safari** → Share → **Add to Home Screen**. **Android:** **Chrome** → menu → **Install app**.
- Full step-by-step guide (Greek): [SETUP-el.md](SETUP-el.md).

## Sync (Dropbox)

- Dropbox app **FamEXP**, access type *App folder*, scopes `files.metadata.read`, `files.content.read`, `files.content.write`. App key `14b0pw6mmormy03` (public; PKCE, no secret).
- Files in `Apps/FamEXP/`: `family.json` (salt + passphrase check, no data) and `devices/<deviceId>.fex` — each phone's full snapshot, AES-256-GCM encrypted with a key derived from the family passphrase (PBKDF2-SHA-256, 600,000 iterations). Each phone writes only its own file and merges the other's record by record (latest change wins; deletions propagate).
- Sync runs on unlock, on return to the app, when back online, every minute while open and ~3 s after each change; "Sync now" in Settings.

## Project structure

```
src/
  routes/       screens
  components/   reusable UI
  db/           IndexedDB schema, seed, helpers
  i18n/         el.json, en.json, formatting
  services/     sync, PDF, Excel, alerts (later phases)
  theme/        colour tokens, ThemeProvider
  types/        data model
public/icons/   app icons (regenerate with scripts/make-icons.py)
```

## Budget

- Tap the budget card on the Home tab to change it: an amount for **this month only**, a **default for all months**, **no budget**, or **reset** a month to the default.
- Alerts at 80 % and 100 % appear once per month on each phone (banner in the app, plus a phone notification if allowed — on iPhone only after adding the app to the home screen).

## Lock & PIN

- The app locks on launch and every time it goes to the background. Unlock with the 4-digit PIN or, if enabled, Face ID / fingerprint (a passkey on the phone).
- The PIN is stored only as a salted hash on that phone; each phone has its own PIN. After 5 wrong PINs the keypad waits 30 seconds.
- A forgotten PIN cannot be recovered: reinstall the app and choose "Join an existing family" to get the data back from Dropbox (from Phase 4).

## Privacy

All data lives on the phones. What goes to Dropbox is encrypted on the phone with a family passphrase, so neither Dropbox nor GitHub can read it. The GitHub repository contains only code.
