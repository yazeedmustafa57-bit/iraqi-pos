/**
 * Sichere PIN/Passwort-Verarbeitung
 * 
 * Verwendet bcrypt für PIN-Hashing.
 * bcrypt ist speziell für Passwort-Hashing entwickelt:
 * - Salting automatisch eingebaut
 * - Adaptive Cost Factor (Work Factor)
 * - Einweg-Hash (nicht umkehrbar)
 * - Schutz gegen Rainbow Table Angriffe
 * - Schutz gegen Timing Angriffe
 */

import bcrypt from 'bcryptjs';

// bcrypt Cost Factor (Work Factor)
// 10 = ~100ms pro Hash (guter Kompromiss zwischen Sicherheit und Performance)
// Erhöhen wenn mehr Rechenleistung verfügbar ist
const BCRYPT_ROUNDS = 10;

// Hash a PIN for storage
// Erzeugt automatisch einen Salt und hasht den PIN
export async function hashPIN(pin: string): Promise<string> {
  return await bcrypt.hash(pin, BCRYPT_ROUNDS);
}

// Verify a PIN against stored hash
// Vergleicht den PIN mit dem gespeicherten Hash
export async function verifyPIN(pin: string, storedHash: string): Promise<boolean> {
  return await bcrypt.compare(pin, storedHash);
}

// Check if a stored value is a bcrypt hash (migration helper)
export function isAlreadyHashed(value: string): boolean {
  // bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 chars long
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
}

// ============================================================
// LOGIN ATTEMPT TRACKING
// 
// Schutz gegen Brute-Force Angriffe:
// - Maximal 5 Fehlversuche
// - Danach 5 Minuten Lockout
// - Lockout wird automatisch aufgehoben
// ============================================================

export interface LoginAttempts {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

export function getLoginAttempts(phone: string): LoginAttempts {
  if (typeof window === 'undefined') return { count: 0, lastAttempt: 0, lockedUntil: null };
  try {
    const stored = localStorage.getItem(`login_attempts_${phone}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { count: 0, lastAttempt: 0, lockedUntil: null };
}

export function recordFailedAttempt(phone: string): LoginAttempts {
  const attempts = getLoginAttempts(phone);
  const now = Date.now();
  
  // Reset if lockout has expired
  if (attempts.lockedUntil && now > attempts.lockedUntil) {
    const fresh = { count: 1, lastAttempt: now, lockedUntil: null };
    localStorage.setItem(`login_attempts_${phone}`, JSON.stringify(fresh));
    return fresh;
  }
  
  const newCount = attempts.count + 1;
  const newAttempts: LoginAttempts = {
    count: newCount,
    lastAttempt: now,
    lockedUntil: newCount >= MAX_ATTEMPTS ? now + LOCKOUT_DURATION : null,
  };
  
  localStorage.setItem(`login_attempts_${phone}`, JSON.stringify(newAttempts));
  return newAttempts;
}

export function clearLoginAttempts(phone: string): void {
  localStorage.removeItem(`login_attempts_${phone}`);
}

export function isLockedOut(phone: string): boolean {
  const attempts = getLoginAttempts(phone);
  if (!attempts.lockedUntil) return false;
  if (Date.now() > attempts.lockedUntil) {
    clearLoginAttempts(phone);
    return false;
  }
  return true;
}

export function getRemainingLockoutTime(phone: string): number {
  const attempts = getLoginAttempts(phone);
  if (!attempts.lockedUntil) return 0;
  return Math.max(0, attempts.lockedUntil - Date.now());
}
