import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const auditRouter = Router();

auditRouter.use(requireAuth);
auditRouter.use(requireRole(['OWNER']));

/**
 * GET /api/audit - View immutable security & financial audit trail
 */
auditRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, entityType, adminId, search, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT 
        a.id,
        a.admin_id,
        a.admin_name,
        a.action,
        a.entity_type,
        a.entity_id,
        a.old_values,
        a.new_values,
        a.ip_address,
        a.created_at
      FROM audit_logs a
      WHERE 1=1
    `;
    const params: any[] = [];

    if (action) {
      params.push(action);
      sql += ` AND a.action = $${params.length}`;
    }

    if (entityType) {
      params.push(entityType);
      sql += ` AND a.entity_type = $${params.length}`;
    }

    if (adminId) {
      params.push(parseInt(adminId as string, 10));
      sql += ` AND a.admin_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (a.action ILIKE $${params.length} OR a.entity_type ILIKE $${params.length} OR a.admin_name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY a.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Math.min(parseInt(limit as string, 10), 100), parseInt(offset as string, 10));

    const result = await query(sql, params);
    const countRes = await query('SELECT COUNT(*) as total FROM audit_logs');

    res.json({
      logs: result.rows,
      total: parseInt(countRes.rows[0].total, 10),
    });
  } catch (err: any) {
    console.error('[Audit Logs Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});
