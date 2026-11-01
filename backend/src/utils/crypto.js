import crypto from 'node:crypto';

/**
 * Hash password using PBKDF2 with SHA-256
 */
export function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password against hashed format (or plain fallback for legacy demo credentials)
 */
export function verifyPassword(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) return false;

  // Direct match for legacy demo credentials
  if (plainPassword === storedPassword) return true;

  // PBKDF2 hash format: "salt:hash"
  if (storedPassword.includes(':')) {
    const [salt, originalHash] = storedPassword.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = crypto.pbkdf2Sync(plainPassword, salt, 1000, 64, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  // SHA256 hex fallback
  const sha256 = crypto.createHash('sha256').update(plainPassword).digest('hex');
  return sha256 === storedPassword;
}
