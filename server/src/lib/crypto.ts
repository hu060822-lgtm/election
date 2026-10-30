import crypto from 'node:crypto';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const newToken = () => crypto.randomBytes(32).toString('base64url');

/** Human-friendly recovery code, e.g. 7KQX-M4TP-9WHC (no ambiguous chars). */
export function newRecoveryCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [0, 4, 8].map((i) => chars.slice(i, i + 4).join('')).join('-');
}
export const normaliseRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function safeEqual(a: string, b: string) {
  const ha = Buffer.from(sha256(a));
  const hb = Buffer.from(sha256(b));
  return crypto.timingSafeEqual(ha, hb);
}
