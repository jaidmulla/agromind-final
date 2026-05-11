import Transport from 'winston-transport';
import { persistApplicationLog } from './log-store';

/** Streams Winston logs into PostgreSQL (`application_logs`, source = app). */
export class PostgresLogTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: Record<string, unknown>, callback: () => void): void {
    const level = String(info.level ?? 'info');
    const message =
      info.message !== undefined && info.message !== null ? String(info.message) : '';

    const { level: _lv, message: _msg, timestamp: _ts, splat: _s, ...meta } = info;

    persistApplicationLog({
      source: 'app',
      level,
      message,
      meta: meta as Record<string, unknown>,
    });

    setImmediate(() => {
      this.emit('logged', info);
      callback();
    });
  }
}
