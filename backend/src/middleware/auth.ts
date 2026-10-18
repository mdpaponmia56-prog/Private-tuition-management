import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

export interface AdminPayload {
  id: number;
  email: string;
  fullName: string;
  role: 'OWNER' | 'ADMINISTRATOR_2' | 'ADMINISTRATOR_3';
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
      sessionId?: string;
    }
  }
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Check cookie first, then Authorization Bearer header
    let token = req.cookies?.tuition_session;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const tokenHash = hashToken(token);

    const sessionRes = await query(
      `SELECT s.id as session_id, s.expires_at, a.id as admin_id, a.email, a.full_name, a.role, a.is_active
       FROM sessions s
       JOIN administrators a ON s.admin_id = a.id
       WHERE s.token_hash = $1`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      res.clearCookie('tuition_session');
      res.status(401).json({ error: 'Session invalid or revoked. Please log in again.' });
      return;
    }

    const session = sessionRes.rows[0];

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await query('DELETE FROM sessions WHERE id = $1', [session.session_id]);
      res.clearCookie('tuition_session');
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }

    // Check if admin is active
    if (!session.is_active) {
      res.status(403).json({ error: 'Administrator account is deactivated.' });
      return;
    }

    // Update last active timestamp asynchronously
    query('UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1', [session.session_id]).catch(() => {});

    req.admin = {
      id: session.admin_id,
      email: session.email,
      fullName: session.full_name,
      role: session.role,
    };
    req.sessionId = session.session_id;

    next();
  } catch (err: any) {
    console.error('[Auth Middleware Error]:', err.message);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

export function requireRole(allowedRoles: Array<'OWNER' | 'ADMINISTRATOR_2' | 'ADMINISTRATOR_3'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.admin.role)) {
      res.status(403).json({ error: 'Access forbidden: Insufficient administrative privileges.' });
      return;
    }
    next();
  };
}
