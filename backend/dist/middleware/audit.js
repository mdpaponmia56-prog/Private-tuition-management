import { query } from '../db/index.js';
export async function recordAuditLog(params) {
    try {
        await query(`INSERT INTO audit_logs (admin_id, admin_name, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            params.adminId || null,
            params.adminName,
            params.action,
            params.entityType,
            params.entityId ? String(params.entityId) : null,
            params.oldValues ? JSON.stringify(params.oldValues) : null,
            params.newValues ? JSON.stringify(params.newValues) : null,
            params.ipAddress || null,
        ]);
    }
    catch (err) {
        console.error('[Audit Log Error]: Failed to write audit log:', err.message);
    }
}
