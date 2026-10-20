import app from './app.js';
import { config } from './config/index.js';
import { testConnection } from './db/index.js';

const server = app.listen(config.port, async () => {
  console.log(`[API Server] Running on http://localhost:${config.port} (${config.nodeEnv})`);
  await testConnection();
});

// Graceful shutdown
const shutdown = () => {
  console.log('[API Server] Graceful shutdown initiated...');
  server.close(() => {
    console.log('[API Server] Closed HTTP server.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
