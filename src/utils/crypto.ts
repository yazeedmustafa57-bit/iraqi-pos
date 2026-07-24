/**
 * Sichere PIN/Passwort-Verarbeitung
 * 
 * Verwendet SHA-256 Hashing für PINs.
 * PINs werden NIE im Klartext gespeichert.
 */

// SHA-256 Hash (Web + Native)
async function sha256(message: string): Promise<string> {
  // Web: SubtleCrypto API
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback: Simple hash (for environments without SubtleCrypto)
  let hash = 0;
  const salt = 'IRAQI_POS_SALT_2024'; // In production: unique per user
  const salted = salt + message + salt;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  // Convert to hex and pad
  return Math.abs(hash).toString(16).padStart(32, '0') + 
         Math.abs(hash * 31).toString(16).padStart(32, '0');
}

// Hash a PIN for storage
export async function hashPIN(pin: string): Promise<string> {
  return await sha256(pin);
}

// Verify a PIN against stored hash
export async function verifyPIN(pin: string, storedHash: string): Promise<boolean> {
  const pinHash = await sha256(pin);
  return pinHash === storedHash;
}

// Check if a stored value is already hashed (migration helper)
export function isAlreadyHashed(value: string): boolean {
  // Hash is always 64 hex characters
  return /^[a-f0-9]{64}$/.test(value);
}

// Login attempt tracking
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
