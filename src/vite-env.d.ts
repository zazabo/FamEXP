/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Dropbox app key (public — PKCE flow, no secret). Used from Phase 4. */
  readonly VITE_DROPBOX_APP_KEY?: string;
  /** Base path for GitHub Pages, e.g. `/family-expenses/`. */
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
