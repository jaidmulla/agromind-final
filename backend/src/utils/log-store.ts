import pool from './database';
import winston from 'winston';

const NPM_LEVELS = winston.config.npm.levels;

export type ApplicationLogSource = 'app' | 'http';

export interface PersistLogInput {
  source: ApplicationLogSource;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
  user_id?: string | null;
  method?: string | null;
  path?: string | null;
  status_code?: number | null;
  duration_ms?: number | null;
  ip?: string | null;
  user_agent?: string | null;
}

function shouldPersistWinstonLevel(level: string): boolean {
  const min = process.env.LOG_DB_MIN_LEVEL || 'debug';
  const lv = NPM_LEVELS[level as keyof typeof NPM_LEVELS];
  const mv = NPM_LEVELS[min as keyof typeof NPM_LEVELS];
  if (lv === undefined || mv === undefined) return true;
  return lv <= mv;
}

function serializeMeta(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta, (_k, v) => {
      if (v instanceof Error) return { message: v.message, stack: v.stack, name: v.name };
      return v;
    });
  } catch {
    return '{}';
  }
}

/** Fire-and-forget insert using the raw pool (avoids the noisy `query()` helper). */
export function persistApplicationLog(row: PersistLogInput): void {
  if (process.env.LOG_TO_DATABASE === 'false') return;
  if (row.source === 'app' && !shouldPersistWinstonLevel(row.level)) return;

  const msg = row.message.length > 12000 ? `${row.message.slice(0, 12000)}…` : row.message;

  setImmediate(() => {
    pool
      .query(
        `INSERT INTO application_logs (
          source, level, message, meta, user_id, method, path, status_code, duration_ms, ip, user_agent
        ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)`,
        [
          row.source,
          row.level,
          msg,
          serializeMeta(row.meta ?? {}),
          row.user_id ?? null,
          row.method ?? null,
          row.path ?? null,
          row.status_code ?? null,
          row.duration_ms ?? null,
          row.ip ?? null,
          row.user_agent ?? null,
        ]
      )
      .catch((err: Error) => {
        console.error('[application_logs]', err.message);
      });
  });
}
