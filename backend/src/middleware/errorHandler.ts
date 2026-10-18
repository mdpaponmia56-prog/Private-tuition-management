import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred.';

  console.error('[Error Handler]:', {
    status: statusCode,
    message: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });

  // Check for common multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: `File size exceeds the limit of ${config.maxPhotoSizeMB}MB.` });
    return;
  }

  if (err.message && (err.message.includes('Only JPEG, PNG') || err.message.includes('Invalid image format'))) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Check for postgres unique constraint errors
  if (err.code === '23505') {
    res.status(409).json({ error: 'A record with this identifier already exists.' });
    return;
  }

  // Check for postgres foreign key violation
  if (err.code === '23503') {
    res.status(400).json({ error: 'Referenced entity does not exist or cannot be removed due to existing relations.' });
    return;
  }

  res.status(statusCode).json({
    error: statusCode === 500 && config.isProduction ? 'Internal Server Error' : message,
  });
}
