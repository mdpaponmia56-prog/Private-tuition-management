import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db/index.js';
import { hashToken, requireAuth } from '../middleware/auth.js';
import { recordAuditLog } from '../middleware/audit.js';
import { config } from '../config/index.js';

export const authRouter = Router();

// Rate limiter for login to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: { error: 'Too many login attempts from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const adminRes = await query(
      `SELECT id, email, full_name, role, password_hash, is_active FROM administrators WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // Generic error message to prevent account enumeration
    if (adminRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const admin = adminRes.rows[0];

    if (!admin.is_active) {
      res.status(403).json({ error: 'Your administrator account has been deactivated.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Generate secure session token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const sessionId = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.sessionMaxAgeDays);

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    await query(
      `INSERT INTO sessions (id, admin_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, admin.id, tokenHash, ip, userAgent, expiresAt]
    );

    // Update last login
    await query(`UPDATE administrators SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`, [admin.id]);

    // Set secure HTTP-only cookie
    res.cookie('tuition_session', rawToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    });

    await recordAuditLog({
      adminId: admin.id,
      adminName: admin.full_name,
      action: 'ADMIN_LOGIN',
      entityType: 'SESSION',
      entityId: sessionId,
      ipAddress: ip,
    });

    res.json({
      message: 'Login successful.',
      token: rawToken,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
      },
    });
  } catch (err: any) {
    console.error('[Login Error]:', err.message);
    res.status(500).json({ error: 'An error occurred during login. Please try again.' });
  }
});

authRouter.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.sessionId) {
      await query('DELETE FROM sessions WHERE id = $1', [req.sessionId]);
    }

    res.clearCookie('tuition_session');

    if (req.admin) {
      await recordAuditLog({
        adminId: req.admin.id,
        adminName: req.admin.fullName,
        action: 'ADMIN_LOGOUT',
        entityType: 'SESSION',
        entityId: req.sessionId,
        ipAddress: req.ip,
      });
    }

    res.json({ message: 'Logged out successfully.' });
  } catch (err: any) {
    console.error('[Logout Error]:', err.message);
    res.status(500).json({ error: 'Logout failed.' });
  }
});

authRouter.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json({ admin: req.admin });
});

authRouter.post('/change-password', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const adminRes = await query('SELECT password_hash FROM administrators WHERE id = $1', [req.admin!.id]);
    const isMatch = await bcrypt.compare(currentPassword, adminRes.rows[0].password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE administrators SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      newHash,
      req.admin!.id,
    ]);

    // Invalidate all other active sessions for this admin
    await query('DELETE FROM sessions WHERE admin_id = $1 AND id != $2', [req.admin!.id, req.sessionId]);

    await recordAuditLog({
      adminId: req.admin!.id,
      adminName: req.admin!.fullName,
      action: 'CHANGE_PASSWORD',
      entityType: 'ADMINISTRATOR',
      entityId: req.admin!.id,
      ipAddress: req.ip,
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err: any) {
    console.error('[Change Password Error]:', err.message);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});
