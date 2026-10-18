import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { DueService } from '../services/due.service.js';

export const dueRouter = Router();

dueRouter.use(requireAuth);

/**
 * GET /api/dues - Get due students summary and list
 */
dueRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId, search, minDue } = req.query;

    const data = await DueService.getDueStudents({
      batchId: batchId ? parseInt(batchId as string, 10) : undefined,
      search: search as string,
      minDue: minDue ? parseFloat(minDue as string) : undefined,
    });

    res.json(data);
  } catch (err: any) {
    console.error('[Due Students Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch outstanding dues.' });
  }
});

/**
 * GET /api/dues/:studentId/reminder - Generate reminder message (Bangla & English)
 */
dueRouter.get('/:studentId/reminder', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const reminder = await DueService.generateReminderText(studentId);
    res.json(reminder);
  } catch (err: any) {
    console.error('[Generate Reminder Error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate reminder.' });
  }
});
