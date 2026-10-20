import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAuditLog } from '../middleware/audit.js';
export const adminRouter = Router();
// Strict private security: All admin management routes require valid authentication
adminRouter.use(requireAuth);
/**
 * GET /api/admins - List all administrators and available spot counts
 */
adminRouter.get('/', async (_req, res) => {
    try {
        const adminRes = await query(`SELECT id, email, full_name, role, is_active, last_login_at, created_at, updated_at 
       FROM administrators 
       ORDER BY id ASC`);
        const administrators = adminRes.rows;
        const currentCount = administrators.length;
        const maxLimit = 3;
        const availableSpots = Math.max(0, maxLimit - currentCount);
        res.json({
            administrators,
            maxLimit,
            currentCount,
            availableSpots,
            isFull: currentCount >= maxLimit,
        });
    }
    catch (err) {
        console.error('[Admin List Error]:', err.message);
        res.status(500).json({ error: 'Failed to retrieve administrator accounts.' });
    }
});
/**
 * POST /api/admins - Create a new administrator account (Owner only, max 3)
 */
adminRouter.post('/', requireRole(['OWNER']), async (req, res) => {
    try {
        const { fullName, email, role = 'ADMINISTRATOR_2', password } = req.body;
        if (!fullName || !fullName.trim()) {
            res.status(400).json({ error: 'Full name is required.' });
            return;
        }
        if (!email || !email.trim() || !email.includes('@')) {
            res.status(400).json({ error: 'A valid email address is required.' });
            return;
        }
        if (!password || password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            return;
        }
        const validRoles = ['OWNER', 'ADMINISTRATOR_2', 'ADMINISTRATOR_3'];
        if (!validRoles.includes(role)) {
            res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
            return;
        }
        const cleanEmail = email.toLowerCase().trim();
        // Check current count
        const countRes = await query('SELECT COUNT(*) as count FROM administrators');
        const currentCount = parseInt(countRes.rows[0].count, 10);
        if (currentCount >= 3) {
            res.status(400).json({
                error: 'System limit reached: Maximum of 3 administrator spots are permitted. Remove an administrator first to add a new one.',
            });
            return;
        }
        // Check email uniqueness
        const dupRes = await query('SELECT id FROM administrators WHERE LOWER(email) = $1', [cleanEmail]);
        if (dupRes.rows.length > 0) {
            res.status(409).json({ error: 'An administrator account with this email already exists.' });
            return;
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const insertRes = await query(`INSERT INTO administrators (email, full_name, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, full_name, role, is_active, created_at, updated_at`, [cleanEmail, fullName.trim(), role, passwordHash]);
        const newAdmin = insertRes.rows[0];
        await recordAuditLog({
            adminId: req.admin.id,
            adminName: req.admin.fullName,
            action: 'CREATE_ADMIN',
            entityType: 'ADMINISTRATOR',
            entityId: newAdmin.id,
            newValues: { email: newAdmin.email, fullName: newAdmin.full_name, role: newAdmin.role },
            ipAddress: req.ip,
        });
        res.status(201).json({
            message: 'Administrator account created successfully.',
            administrator: newAdmin,
        });
    }
    catch (err) {
        console.error('[Admin Create Error]:', err.message);
        if (err.message && err.message.includes('Maximum of exactly three')) {
            res.status(400).json({ error: 'System limit reached: Maximum of 3 administrator accounts permitted.' });
            return;
        }
        res.status(500).json({ error: err.message || 'Failed to create administrator account.' });
    }
});
/**
 * PUT /api/admins/:id - Edit an administrator (Owner or self)
 */
adminRouter.put('/:id', async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (isNaN(targetId)) {
            res.status(400).json({ error: 'Invalid administrator ID.' });
            return;
        }
        const isSelf = req.admin.id === targetId;
        const isOwner = req.admin.role === 'OWNER';
        if (!isSelf && !isOwner) {
            res.status(403).json({ error: 'Insufficient permissions. Only Lead Owner can edit other administrators.' });
            return;
        }
        // Fetch existing target admin
        const targetRes = await query('SELECT id, email, full_name, role, is_active FROM administrators WHERE id = $1', [targetId]);
        if (targetRes.rows.length === 0) {
            res.status(404).json({ error: 'Administrator not found.' });
            return;
        }
        const currentAdmin = targetRes.rows[0];
        const { fullName, email, role, password, isActive } = req.body;
        const updates = [];
        const values = [];
        let paramIndex = 1;
        // Full name
        if (fullName !== undefined) {
            if (!fullName.trim()) {
                res.status(400).json({ error: 'Full name cannot be empty.' });
                return;
            }
            updates.push(`full_name = $${paramIndex++}`);
            values.push(fullName.trim());
        }
        // Email
        if (email !== undefined && email.toLowerCase().trim() !== currentAdmin.email.toLowerCase()) {
            const cleanEmail = email.toLowerCase().trim();
            if (!cleanEmail.includes('@')) {
                res.status(400).json({ error: 'Invalid email address.' });
                return;
            }
            const dup = await query('SELECT id FROM administrators WHERE LOWER(email) = $1 AND id != $2', [cleanEmail, targetId]);
            if (dup.rows.length > 0) {
                res.status(409).json({ error: 'Email address is already in use by another account.' });
                return;
            }
            updates.push(`email = $${paramIndex++}`);
            values.push(cleanEmail);
        }
        // Role (Owner only)
        if (role !== undefined) {
            if (!isOwner) {
                res.status(403).json({ error: 'Only Lead Owner can modify administrator roles.' });
                return;
            }
            const validRoles = ['OWNER', 'ADMINISTRATOR_2', 'ADMINISTRATOR_3'];
            if (!validRoles.includes(role)) {
                res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
                return;
            }
            // If demoting from OWNER, check if there is at least one other active OWNER
            if (currentAdmin.role === 'OWNER' && role !== 'OWNER') {
                const ownerCountRes = await query("SELECT COUNT(*) as count FROM administrators WHERE role = 'OWNER' AND id != $1 AND is_active = true", [targetId]);
                if (parseInt(ownerCountRes.rows[0].count, 10) === 0) {
                    res.status(400).json({ error: 'Cannot change role: System requires at least one active Lead Owner account.' });
                    return;
                }
            }
            updates.push(`role = $${paramIndex++}`);
            values.push(role);
        }
        // Password
        if (password) {
            if (typeof password !== 'string' || password.length < 6) {
                res.status(400).json({ error: 'New password must be at least 6 characters long.' });
                return;
            }
            const newHash = await bcrypt.hash(password, 12);
            updates.push(`password_hash = $${paramIndex++}`);
            values.push(newHash);
        }
        // Active status (Owner only)
        if (isActive !== undefined) {
            if (!isOwner) {
                res.status(403).json({ error: 'Only Lead Owner can alter active status.' });
                return;
            }
            const activeBool = Boolean(isActive);
            if (!activeBool && currentAdmin.role === 'OWNER') {
                const ownerCountRes = await query("SELECT COUNT(*) as count FROM administrators WHERE role = 'OWNER' AND id != $1 AND is_active = true", [targetId]);
                if (parseInt(ownerCountRes.rows[0].count, 10) === 0) {
                    res.status(400).json({ error: 'Cannot deactivate the sole active Lead Owner account.' });
                    return;
                }
            }
            updates.push(`is_active = $${paramIndex++}`);
            values.push(activeBool);
            // If deactivating, revoke all active sessions
            if (!activeBool) {
                await query('DELETE FROM sessions WHERE admin_id = $1', [targetId]);
            }
        }
        if (updates.length === 0) {
            res.status(400).json({ error: 'No valid fields provided for update.' });
            return;
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(targetId);
        const updateSql = `
      UPDATE administrators
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, full_name, role, is_active, last_login_at, created_at, updated_at
    `;
        const updatedRes = await query(updateSql, values);
        const updatedAdmin = updatedRes.rows[0];
        await recordAuditLog({
            adminId: req.admin.id,
            adminName: req.admin.fullName,
            action: 'UPDATE_ADMIN',
            entityType: 'ADMINISTRATOR',
            entityId: targetId,
            oldValues: currentAdmin,
            newValues: updatedAdmin,
            ipAddress: req.ip,
        });
        res.json({
            message: 'Administrator account updated successfully.',
            administrator: updatedAdmin,
        });
    }
    catch (err) {
        console.error('[Admin Update Error]:', err.message);
        res.status(500).json({ error: err.message || 'Failed to update administrator account.' });
    }
});
/**
 * DELETE /api/admins/:id - Remove an administrator account (Owner only, leaves spot vacant)
 */
adminRouter.delete('/:id', requireRole(['OWNER']), async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (isNaN(targetId)) {
            res.status(400).json({ error: 'Invalid administrator ID.' });
            return;
        }
        // Check total admins count
        const totalCountRes = await query('SELECT COUNT(*) as count FROM administrators');
        const totalCount = parseInt(totalCountRes.rows[0].count, 10);
        if (totalCount <= 1) {
            res.status(400).json({ error: 'Cannot delete: System must retain at least one administrator account.' });
            return;
        }
        const targetRes = await query('SELECT id, email, full_name, role FROM administrators WHERE id = $1', [targetId]);
        if (targetRes.rows.length === 0) {
            res.status(404).json({ error: 'Administrator account not found.' });
            return;
        }
        const targetAdmin = targetRes.rows[0];
        // Cannot delete if this is the only active OWNER
        if (targetAdmin.role === 'OWNER') {
            const otherOwnersRes = await query("SELECT COUNT(*) as count FROM administrators WHERE role = 'OWNER' AND id != $1 AND is_active = true", [targetId]);
            if (parseInt(otherOwnersRes.rows[0].count, 10) === 0) {
                res.status(400).json({ error: 'Cannot delete the only Lead Owner account. Promote another admin to OWNER first.' });
                return;
            }
        }
        await withTransaction(async (client) => {
            // Clear sessions
            await client.query('DELETE FROM sessions WHERE admin_id = $1', [targetId]);
            // Remove admin record
            await client.query('DELETE FROM administrators WHERE id = $1', [targetId]);
        });
        await recordAuditLog({
            adminId: req.admin.id,
            adminName: req.admin.fullName,
            action: 'DELETE_ADMIN',
            entityType: 'ADMINISTRATOR',
            entityId: targetId,
            oldValues: targetAdmin,
            ipAddress: req.ip,
        });
        res.json({
            message: `Administrator "${targetAdmin.full_name}" removed successfully. An admin spot (1 of 3) is now vacant and available.`,
            deletedId: targetId,
        });
    }
    catch (err) {
        console.error('[Admin Delete Error]:', err.message);
        res.status(500).json({ error: err.message || 'Failed to remove administrator account.' });
    }
});
