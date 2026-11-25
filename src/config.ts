/**
 * Build-time configuration. The Dropbox app key is public by design (OAuth PKCE, no app
 * secret), so a default for the family's "FamEXP" app is kept here; VITE_DROPBOX_APP_KEY
 * overrides it.
 */
export const DROPBOX_APP_KEY: string = import.meta.env.VITE_DROPBOX_APP_KEY || '14b0pw6mmormy03';
