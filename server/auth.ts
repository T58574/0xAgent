import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const APP_DIR = path.join(os.homedir(), '.0xagent');
const AUTH_FILE = path.join(APP_DIR, 'auth.json');

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha256';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

interface AuthStorageData {
  passwordHash: string | null;
  salt: string | null;
  isPasswordSet: boolean;
  secret: string;
}

// In-memory auth cache, active tokens with TTL, and brute force state
interface TokenRecord {
  createdAt: number;
}
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days TTL
const activeTokens = new Map<string, TokenRecord>();
let failedAttemptsCount = 0;
let lockoutUntilTimestamp = 0;
let cachedAuthData: AuthStorageData | null = null;

function ensureAppDir(): void {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
}

function loadAuthData(): AuthStorageData {
  if (cachedAuthData !== null) {
    return cachedAuthData;
  }

  ensureAppDir();
  if (!fs.existsSync(AUTH_FILE)) {
    const initialData: AuthStorageData = {
      passwordHash: null,
      salt: null,
      isPasswordSet: false,
      secret: crypto.randomBytes(32).toString('hex'),
    };
    saveAuthData(initialData);
    return initialData;
  }

  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedAuthData = {
      passwordHash: parsed.passwordHash || null,
      salt: parsed.salt || null,
      isPasswordSet: Boolean(parsed.isPasswordSet && parsed.passwordHash),
      secret: parsed.secret || crypto.randomBytes(32).toString('hex'),
    };
    return cachedAuthData;
  } catch (err) {
    console.error('Failed to parse auth.json:', err);
    cachedAuthData = {
      passwordHash: null,
      salt: null,
      isPasswordSet: false,
      secret: crypto.randomBytes(32).toString('hex'),
    };
    return cachedAuthData;
  }
}

function saveAuthData(data: AuthStorageData): void {
  ensureAppDir();
  cachedAuthData = { ...data };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
}

export function isPasswordSet(): boolean {
  const authData = loadAuthData();
  return authData.isPasswordSet && Boolean(authData.passwordHash);
}

export function checkBruteForceLockout(): { locked: boolean; remainingSec: number } {
  const now = Date.now();
  if (lockoutUntilTimestamp > now) {
    const remainingSec = Math.ceil((lockoutUntilTimestamp - now) / 1000);
    return { locked: true, remainingSec };
  }

  // Cooldown expired
  if (lockoutUntilTimestamp > 0 && lockoutUntilTimestamp <= now) {
    lockoutUntilTimestamp = 0;
    failedAttemptsCount = 0;
  }

  return { locked: false, remainingSec: 0 };
}

export function recordFailedAttempt(): { locked: boolean; remainingSec: number; attemptsLeft: number } {
  failedAttemptsCount++;
  if (failedAttemptsCount >= MAX_FAILED_ATTEMPTS) {
    lockoutUntilTimestamp = Date.now() + LOCKOUT_DURATION_MS;
    const remainingSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    console.warn(`[SECURITY] 5 failed login attempts detected! Lockout activated for 15 minutes.`);
    return { locked: true, remainingSec, attemptsLeft: 0 };
  }

  return {
    locked: false,
    remainingSec: 0,
    attemptsLeft: MAX_FAILED_ATTEMPTS - failedAttemptsCount,
  };
}

export function resetFailedAttempts(): void {
  failedAttemptsCount = 0;
  lockoutUntilTimestamp = 0;
}

export function createSessionToken(): string {
  const authData = loadAuthData();
  const payload = Buffer.from(`${Date.now()}:${crypto.randomBytes(16).toString('hex')}`).toString('base64url');
  const hmac = crypto.createHmac('sha256', authData.secret).update(payload).digest('hex');
  const token = `0xagt_${payload}.${hmac}`;
  activeTokens.set(token, { createdAt: Date.now() });
  return token;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  // If master password is not set yet, allow access to set it up
  if (!isPasswordSet()) return true;

  if (!token) return false;
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  if (!cleanToken.startsWith('0xagt_')) return false;

  const raw = cleanToken.slice(6);
  const parts = raw.split('.');
  if (parts.length !== 2) return false;

  const [payload, hmac] = parts;
  const authData = loadAuthData();
  const expectedHmac = crypto.createHmac('sha256', authData.secret).update(payload).digest('hex');

  if (hmac.length !== expectedHmac.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    const timestamp = parseInt(decoded.split(':')[0], 10);
    if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL_MS) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

export function revokeSessionToken(token: string | undefined | null): void {
  if (!token) return;
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  activeTokens.delete(cleanToken);
}

export function setupMasterPassword(password: string): { success: boolean; token?: string; error?: string } {
  if (!password || password.trim().length < 4) {
    return { success: false, error: 'Пароль должен содержать минимум 4 символа' };
  }

  const authData = loadAuthData();
  if (authData.isPasswordSet) {
    return { success: false, error: 'Мастер-пароль уже установлен. Используйте вход или смену пароля.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  authData.salt = salt;
  authData.passwordHash = passwordHash;
  authData.isPasswordSet = true;
  saveAuthData(authData);

  resetFailedAttempts();
  const token = createSessionToken();
  return { success: true, token };
}

export function loginMasterPassword(password: string): {
  success: boolean;
  token?: string;
  error?: string;
  locked?: boolean;
  remainingSec?: number;
  attemptsLeft?: number;
} {
  const lockout = checkBruteForceLockout();
  if (lockout.locked) {
    return {
      success: false,
      error: `Превышено количество попыток. Защита от брутфорса активна. Повторите попытку через ${lockout.remainingSec} сек.`,
      locked: true,
      remainingSec: lockout.remainingSec,
    };
  }

  const authData = loadAuthData();
  if (!authData.isPasswordSet || !authData.passwordHash || !authData.salt) {
    return { success: false, error: 'Пароль не установлен' };
  }

  const testHash = hashPassword(password, authData.salt);
  if (testHash === authData.passwordHash) {
    resetFailedAttempts();
    const token = createSessionToken();
    return { success: true, token };
  }

  const failInfo = recordFailedAttempt();
  if (failInfo.locked) {
    return {
      success: false,
      error: `Неверный пароль! Превышено количество попыток. Доступ заблокирован на 15 минут (${failInfo.remainingSec} сек).`,
      locked: true,
      remainingSec: failInfo.remainingSec,
      attemptsLeft: 0,
    };
  }

  return {
    success: false,
    error: `Неверный пароль! Осталось попыток: ${failInfo.attemptsLeft}`,
    locked: false,
    attemptsLeft: failInfo.attemptsLeft,
  };
}

export function changeMasterPassword(currentPassword: string, newPassword: string): { success: boolean; token?: string; error?: string } {
  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, error: 'Новый пароль должен содержать минимум 4 символа' };
  }

  const authData = loadAuthData();
  if (!authData.isPasswordSet || !authData.passwordHash || !authData.salt) {
    return { success: false, error: 'Пароль не установлен' };
  }

  const currentHash = hashPassword(currentPassword, authData.salt);
  if (currentHash !== authData.passwordHash) {
    return { success: false, error: 'Текущий пароль указан неверно' };
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = hashPassword(newPassword, newSalt);

  authData.salt = newSalt;
  authData.passwordHash = newHash;
  authData.secret = crypto.randomBytes(32).toString('hex');
  saveAuthData(authData);

  // Clear existing active tokens and issue fresh token
  activeTokens.clear();
  const newSessionToken = createSessionToken();
  return { success: true, token: newSessionToken };
}
