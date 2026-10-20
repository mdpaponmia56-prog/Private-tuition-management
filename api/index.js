import app from '../backend/dist/app.js';

export default function handler(req, res) {
  if (req.url === '/api/ping' || req.url === '/ping') {
    return res.status(200).json({ status: 'PONG', runtime: 'vercel-serverless', timestamp: new Date().toISOString() });
  }
  return app(req, res);
}
