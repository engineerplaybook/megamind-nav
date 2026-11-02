import { Pool } from 'pg';
import { getRagConfig } from './config';

const globalForRag = globalThis as typeof globalThis & { __ragPool?: Pool };

export function getPool(): Pool {
  if (!globalForRag.__ragPool) {
    globalForRag.__ragPool = new Pool({
      connectionString: getRagConfig().databaseUrl,
      max: 5,
    });
  }

  return globalForRag.__ragPool;
}

export async function closePool(): Promise<void> {
  if (!globalForRag.__ragPool) return;

  const pool = globalForRag.__ragPool;
  globalForRag.__ragPool = undefined;
  await pool.end();
}

export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
