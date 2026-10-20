import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

const connectionString = config.databaseUrl || 'postgresql://localhost:5432/tuition_placeholder';
export const pool = new Pool({
  connectionString,
  ssl: (!config.databaseUrl || config.databaseUrl.includes('localhost')) ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development' && duration > 500) {
    console.warn(`[DB Slow Query] ${duration}ms: ${text.slice(0, 100)}`);
  }
  return res;
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<boolean> {
  if (!config.databaseUrl) {
    console.warn('[DB Connection]: DATABASE_URL is not configured in environment variables.');
    return false;
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database ping timeout after 3500ms')), 3500)
    );
    const queryPromise = pool.query('SELECT NOW() as current_time, current_database() as db_name');
    const res = await Promise.race([queryPromise, timeoutPromise]);
    console.log(`[DB Connected] DB: ${res.rows[0].db_name} at ${res.rows[0].current_time}`);
    return true;
  } catch (err: any) {
    console.error('[DB Connection Failed]:', err.message);
    return false;
  }
}
