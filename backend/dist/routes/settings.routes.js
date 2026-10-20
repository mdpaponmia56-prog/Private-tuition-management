import { Router } from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAuditLog } from '../middleware/audit.js';
export const settingsRouter = Router();
settingsRouter.use(requireAuth);
/**
 * GET /api/settings - Read application settings and administrator accounts
 */
settingsRouter.get('/', async (_req, res) => {
    try {
        const settingsRes = await query('SELECT key, value, description FROM application_settings');
        const settings = {};
        settingsRes.rows.forEach((r) => {
            settings[r.key] = r.value;
        });
        // Fetch pre-provisioned administrator identities (password_hash is strictly excluded)
        const adminRes = await query(`SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM administrators ORDER BY id ASC`);
        res.json({
            settings,
            administrators: adminRes.rows,
            adminCountLimit: 3,
            currentAdminCount: adminRes.rows.length,
        });
    }
    catch (err) {
        console.error('[Settings Fetch Error]:', err.message);
        res.status(500).json({ error: 'Failed to fetch application settings.' });
    }
});
/**
 * PUT /api/settings - Update institutional settings (Owner only)
 */
settingsRouter.put('/', requireRole(['OWNER']), async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            res.status(400).json({ error: 'Settings object is required.' });
            return;
        }
        const allowedKeys = [
            'institution_name',
            'institution_contact',
            'institution_address',
            'default_currency',
            'currency_symbol',
            'default_timezone',
            'default_interface_language',
            'default_billing_mode',
            'receipt_prefix',
            'student_id_prefix',
        ];
        for (const [key, value] of Object.entries(settings)) {
            if (allowedKeys.includes(key)) {
                await query(`INSERT INTO application_settings (key, value, updated_at, updated_by)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
           ON CONFLICT (key) DO UPDATE 
           SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by`, [key, String(value), req.admin.id]);
            }
        }
        await recordAuditLog({
            adminId: req.admin.id,
            adminName: req.admin.fullName,
            action: 'UPDATE_SETTINGS',
            entityType: 'APPLICATION_SETTINGS',
            newValues: settings,
            ipAddress: req.ip,
        });
        res.json({ message: 'Settings updated successfully.' });
    }
    catch (err) {
        console.error('[Update Settings Error]:', err.message);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
});
