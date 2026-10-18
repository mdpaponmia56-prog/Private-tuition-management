import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, testConnection } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('[Migration] Starting database migration...');
  const isConnected = await testConnection();
  if (!isConnected) {
    throw new Error('Database connection failed. Migration aborted.');
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[Migration] Executing schema.sql statements...');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[Migration] Successfully executed all schema migrations.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// If executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(async () => {
      console.log('[Migration] Finished.');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Migration Fatal]:', err);
      await pool.end();
      process.exit(1);
    });
}
