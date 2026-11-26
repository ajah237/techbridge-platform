/**
 * Client-side rate limiter for auth endpoints.
 * Tracks attempts per normalized key (e.g. email) and enforces cooldown after max attempts.
 * Persists state to sessionStorage (with in-memory fallback) so page reloads do not reset active lockouts.
 */

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}

const STORAGE_PREFIX = "tb_rl:";
const memoryStore = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function getEntry(rawKey: string): RateLimitEntry | undefined {
  const key = normalizeKey(rawKey);
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_PREFIX + key) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as RateLimitEntry;
      memoryStore.set(key, parsed);
      return parsed;
    }
  } catch {
    /* ignore storage errors */
  }
  return memoryStore.get(key);
}

function setEntry(rawKey: string, entry: RateLimitEntry): void {
  const key = normalizeKey(rawKey);
  memoryStore.set(key, entry);
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    }
  } catch {
    /* ignore storage errors */
  }
}

function deleteEntry(rawKey: string): void {
  const key = normalizeKey(rawKey);
  memoryStore.delete(key);
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = getEntry(key);

  if (!entry) return { allowed: true };

  // Enforce active lockout first
  if (now < entry.lockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Clean expired entries once both window and lockout have elapsed
  if (now > entry.firstAttempt + WINDOW_MS && now >= entry.lockedUntil) {
    deleteEntry(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordAttempt(key: string): { locked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  let entry = getEntry(key);

  // Never reset an active lockout even if firstAttempt + WINDOW_MS has passed
  if (entry && now < entry.lockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { locked: true, retryAfterSeconds };
  }

  if (!entry || now > entry.firstAttempt + WINDOW_MS) {
    entry = { attempts: 1, firstAttempt: now, lockedUntil: 0 };
    setEntry(key, entry);
    return { locked: false };
  }

  entry.attempts++;

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    setEntry(key, entry);
    const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
    return { locked: true, retryAfterSeconds };
  }

  setEntry(key, entry);
  return { locked: false };
}

export function clearRateLimit(key: string) {
  deleteEntry(key);
}
