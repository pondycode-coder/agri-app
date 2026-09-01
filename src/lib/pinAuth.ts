const SALT = 'agriapp-pin-v1';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string): Promise<string> {
  return sha256(`${SALT}:${pin}`);
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  return computed === storedHash;
}

/**
 * Supabase requires account passwords of at least 6 characters, but PINs are
 * 4 digits. To establish a real session (so RLS data displays) the PIN is
 * mapped to a deterministic, valid-length password used for Supabase auth.
 * The DB functions (set_my_pin / admin_set_pin) must use the same prefix.
 */
export const PIN_SECRET_PREFIX = 'agri-app-pin-';
export const pinToSecret = (pin: string): string => `${PIN_SECRET_PREFIX}${pin}`;

/**
 * Supabase identifies accounts by email, but the app is PIN-only. A stable
 * internal email is derived from the PIN so the user only ever enters their
 * 4-digit PIN. This also prevents two accounts choosing the same PIN (the
 * second registration fails with "account already exists").
 */
export const pinToEmail = (pin: string): string => `${pin}@local.agri`;


