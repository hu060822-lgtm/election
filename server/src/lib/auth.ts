import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db.js';
import { config } from '../config.js';
import { HttpError } from './http.js';
import { sha256 } from './crypto.js';

export const USER_COOKIE = 'tew_session';
export const ADMIN_COOKIE = 'tew_admin';
const YEAR = 365 * 24 * 3600 * 1000;

export type SessionUser = {
  id: string;
  nickname: string;
  show_predictions: boolean;
  show_support: boolean;
  is_demo: boolean;
  is_banned: boolean;
  created_at: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser | null;
      isAdmin?: boolean;
    }
  }
}

export function setUserCookie(res: Response, token: string) {
  res.cookie(USER_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: YEAR, path: '/' });
}
export function clearUserCookie(res: Response) {
  res.clearCookie(USER_COOKIE, { path: '/' });
}

/** Resolves the session cookie to a user (or null). Never trusts anything sent by the client but the opaque token. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[USER_COOKIE];
    req.user = null;
    if (typeof token === 'string' && token.length >= 20) {
      const { rows } = await pool.query<SessionUser>(
        `UPDATE users SET last_seen_at = now() WHERE token_hash = $1
         RETURNING id, nickname, show_predictions, show_support, is_demo, is_banned, created_at`,
        [sha256(token)],
      );
      req.user = rows[0] ?? null;
    }
    next();
  } catch (e) {
    next(e);
  }
}

export function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'not_joined', '請先以暱稱加入觀測站');
  if (req.user.is_banned) throw new HttpError(403, 'banned', '此帳號已被管理員停用');
  return req.user;
}

export async function loadAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[ADMIN_COOKIE];
    req.isAdmin = false;
    if (typeof token === 'string' && token.length >= 20) {
      const { rowCount } = await pool.query(`SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()`, [sha256(token)]);
      req.isAdmin = !!rowCount;
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** Server-side admin gate — every /api/admin route (except login) passes through this. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.isAdmin) return next(new HttpError(401, 'admin_required', '需要管理員權限'));
  next();
}

/**
 * CSRF defence: cookies are SameSite=Lax and every state-changing request must carry a custom
 * header, which browsers will not attach to cross-site form posts.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-tew-client') !== '1') return next(new HttpError(403, 'csrf', '請求來源驗證失敗'));
  next();
}
