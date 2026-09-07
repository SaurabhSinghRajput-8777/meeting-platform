import type { AppUser } from "@/types";

const STORAGE_KEY = "scaler.identity";

export interface StoredIdentity {
  user_id: string;
  name: string;
}

export function getStoredIdentity(): StoredIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

export function storeIdentity(identity: StoredIdentity, sessionOnly = false): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  if (!sessionOnly) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  }
}

export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Resolve the current application user.
 *
 * First visit  → the backend's default mock user (usr_default_host / Demo User).
 * Repeat visit → the stored identity (which may be a guest identity created in
 *                the lobby when the display name was changed).
 *
 * This is the frontend half of the auth abstraction: the app works without
 * any login while remaining extendable to Clerk (see README).
 */
export async function resolveIdentity(api: {
  getMe: () => Promise<AppUser>;
}): Promise<AppUser> {
  try {
    const me = await api.getMe(); // uses the stored X-User-Id header if present
    storeIdentity({ user_id: me.id, name: me.name });
    return me;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      // Stale/unknown stored identity — fall back to the default user.
      clearIdentity();
      const me = await api.getMe();
      storeIdentity({ user_id: me.id, name: me.name });
      return me;
    }
    throw error;
  }
}
