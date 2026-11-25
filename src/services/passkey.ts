import { fromBase64Url, randomBytes, toBase64Url } from './bytes';

/**
 * Face ID / fingerprint unlock through a device passkey (WebAuthn platform authenticator
 * with user verification). There is no server: a successful, user-verified assertion for
 * our credential is what unlocks the app. Like the PIN, this is a lock against children,
 * not account sign-in. The PIN always remains as fallback.
 */

export async function isPasskeyAvailable(): Promise<boolean> {
  try {
    return (
      typeof window.PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Create a passkey on this phone. Must be called from a tap (browsers require a user gesture). */
export async function registerPasskey(appName: string, userName: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: appName },
      user: { id: randomBytes(16), name: userName, displayName: userName },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Passkey creation cancelled');
  return toBase64Url(new Uint8Array(cred.rawId));
}

/** Ask for Face ID / fingerprint. Resolves true only for a user-verified assertion of our credential. */
export async function verifyPasskey(credentialId: string): Promise<boolean> {
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!assertion || toBase64Url(new Uint8Array(assertion.rawId)) !== credentialId) return false;
    const response = assertion.response as AuthenticatorAssertionResponse;
    const flags = new Uint8Array(response.authenticatorData)[32] ?? 0;
    const userVerified = (flags & 0x04) !== 0;
    return userVerified;
  } catch {
    return false;
  }
}
