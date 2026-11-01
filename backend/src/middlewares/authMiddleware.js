import crypto from 'node:crypto';
import { User } from '../models/User.js';

const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || 'saans_super_secret_admin_key_2026';

/**
 * Sign an admin session token
 */
export function signAdminToken(adminData) {
  const payload = JSON.stringify({
    id: adminData._id || 'admin_root',
    username: adminData.email || 'admin123',
    role: 'admin',
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  const b64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(b64).digest('base64url');
  return `${b64}.${signature}`;
}

/**
 * Verify signed admin session token
 */
export function verifyAdminToken(token) {
  if (!token || !token.includes('.')) return null;
  const [b64, signature] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(b64).digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Role-based authorization middleware
 * Protects admin routes on the backend.
 * Rejects normal users and unauthenticated requests with 401 or 403 Forbidden.
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-admin-token'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : customHeader;

  if (!token) {
    return res.status(401).json({
      statusCode: 401,
      success: false,
      message: 'Authentication required. Please log in to the SAANS Admin Portal.',
    });
  }

  const verified = verifyAdminToken(token);
  if (!verified || verified.role !== 'admin') {
    return res.status(403).json({
      statusCode: 403,
      success: false,
      message: 'Access Denied: Administrator privileges required to access this resource.',
    });
  }

  req.adminUser = verified;
  next();
}
