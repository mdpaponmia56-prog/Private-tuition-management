import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { testConnection } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';
// Route imports
import { authRouter } from './routes/auth.routes.js';
import { batchRouter } from './routes/batch.routes.js';
import { studentRouter } from './routes/student.routes.js';
import { billingRouter } from './routes/billing.routes.js';
import { paymentRouter } from './routes/payment.routes.js';
import { dueRouter } from './routes/due.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { adminRouter } from './routes/admin.routes.js';
export const app = express();
app.set('trust proxy', 1);
const helmetFn = helmet?.default || helmet;
const corsFn = cors?.default || cors;
const cookieParserFn = cookieParser?.default || cookieParser;
// Security HTTP headers
app.use(helmetFn({
    contentSecurityPolicy: false, // Managed per deployment
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// CORS configuration
app.use(corsFn({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin)
            return callback(null, true);
        // Allow localhost on any port for local development
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }
        if (origin === config.clientUrl || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(cookieParserFn(config.sessionSecret));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
// Health Check Endpoint (safe, unprivileged)
app.get(['/api/health', '/health'], async (_req, res) => {
    const isDbHealthy = await testConnection();
    res.status(isDbHealthy ? 200 : 503).json({
        status: isDbHealthy ? 'HEALTHY' : 'UNHEALTHY',
        service: 'tuition-management-api',
        timezone: 'Asia/Dhaka',
        timestamp: new Date().toISOString(),
    });
});
// Protected & Core API Routes (support both with and without /api prefix)
app.use(['/api/auth', '/auth'], authRouter);
app.use(['/api/batches', '/batches'], batchRouter);
app.use(['/api/students', '/students'], studentRouter);
app.use(['/api/billing', '/billing'], billingRouter);
app.use(['/api/payments', '/payments'], paymentRouter);
app.use(['/api/dues', '/dues'], dueRouter);
app.use(['/api/dashboard', '/dashboard'], dashboardRouter);
app.use(['/api/reports', '/reports'], reportRouter);
app.use(['/api/settings', '/settings'], settingsRouter);
app.use(['/api/admins', '/admins'], adminRouter);
app.use(['/api/admin', '/admin'], adminRouter);
app.use(['/api/audit', '/audit'], auditRouter);
app.use(['/api/audit-logs', '/audit-logs'], auditRouter);
import fs from 'fs';
import path from 'path';
// Serve frontend SPA static files if present (only when running as standalone local monolith, not on Vercel)
if (!process.env.VERCEL) {
    const possibleDistPaths = [
        path.resolve(process.cwd(), '../frontend/dist'),
        path.resolve(process.cwd(), 'frontend/dist'),
    ];
    for (const p of possibleDistPaths) {
        if (fs.existsSync(path.join(p, 'index.html'))) {
            app.use(express.static(p));
            app.get('*', (req, res, next) => {
                if (req.path.startsWith('/api') || req.path === '/health')
                    return next();
                res.sendFile(path.join(p, 'index.html'));
            });
            break;
        }
    }
}
// Fallback for non-existent API routes
app.use(['/api/*', '/*'], (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});
// Centralized error handler
app.use(errorHandler);
export default app;
