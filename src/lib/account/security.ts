import {createCipheriv, createDecipheriv, randomBytes, createHash} from 'node:crypto';

export const SESSION_COOKIE = '__Host-atlas-account';
export const FLOW_COOKIE = '__Host-atlas-google-flow';
export interface AccountSession {sub: string; email: string; expires: number}
export function accountConfig() {
  const origin = process.env.ATLAS_ACCOUNT_ORIGIN || '';
  const key = process.env.ATLAS_ACCOUNT_MASTER_KEY || '';
  if (!/^https:\/\/[^/]+$/.test(origin) || new URL(origin).origin !== origin || !/^[a-f0-9]{64}$/i.test(key)
      || !process.env.ATLAS_GOOGLE_CLIENT_ID || !process.env.ATLAS_GOOGLE_CLIENT_SECRET
      || !process.env.ATLAS_ACCOUNT_EMAIL) throw new Error('Account recovery is not configured.');
  return {origin, key: Buffer.from(key, 'hex'), clientId: process.env.ATLAS_GOOGLE_CLIENT_ID,
    clientSecret: process.env.ATLAS_GOOGLE_CLIENT_SECRET, email: process.env.ATLAS_ACCOUNT_EMAIL.toLowerCase()};
}
export function seal(value: unknown, purpose: string, key: Buffer): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`atlas-account-v1:${purpose}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function unseal<T>(value: string, purpose: string, key: Buffer): T {
  if (value.length > 16384) throw new Error('Invalid account record.');
  const bytes = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(`atlas-account-v1:${purpose}`));
  cipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
}
export function cookieValue(request: Request, name: string) {
  return (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length+1) || '';
}
export function readSession(request: Request): AccountSession | null {
  try {
    const config = accountConfig();
    const session = unseal<AccountSession>(cookieValue(request, SESSION_COOKIE), 'session', config.key);
    if (!session.sub || session.email !== config.email || !Number.isFinite(session.expires) || session.expires <= Date.now()) return null;
    return session;
  } catch { return null; }
}
export function accountId(sub: string) {return createHash('sha256').update(`google:${sub}`).digest('hex');}
export function mutationAllowed(request: Request) {
  return request.headers.get('origin') === accountConfig().origin && request.headers.get('x-atlas-account') === '1';
}
export function verifiedOwner(profile: {sub?: unknown; email?: unknown; email_verified?: unknown}, email: string) {
  return typeof profile.sub === 'string' && /^[a-zA-Z0-9_-]{1,255}$/.test(profile.sub)
    && profile.email_verified === true && typeof profile.email === 'string' && profile.email.toLowerCase() === email.toLowerCase();
}
