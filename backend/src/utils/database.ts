import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useSSL = ['true', '1', 'yes'].includes(
  (process.env.DB_SSL || '').toLowerCase()
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

// Handle unexpected errors
pool.on('error', (err) => {
  console.error('❌ Unexpected DB error on idle client', err);
});

// Test connection once on startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
})();

// Query helper
export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    console.log('🧠 Query:', text);
    console.log('⏱ Time:', Date.now() - start, 'ms');
    return res;
  } catch (err) {
    console.error('❌ DB ERROR:', err);
    throw err;
  }
};

// Get raw client
export const getClient = async (): Promise<PoolClient> => {
  return pool.connect();
};

// Transaction helper
export const transaction = async <T>(
  cb: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await cb(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ TRANSACTION ERROR:', err);
    throw err;
  } finally {
    client.release();
  }
};

export default pool;