import 'dotenv/config';
import { resolve } from 'path';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

function optionalNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  adminTelegramId: BigInt(optional('ADMIN_TELEGRAM_ID', optional('ADMIN_TELEGRAM_IDS', '0')).split(',')[0].trim()),
  adminTelegramIds: (() => {
    const ids = optional('ADMIN_TELEGRAM_IDS', '') || optional('ADMIN_TELEGRAM_ID', '');
    return ids.split(',').map(s => BigInt(s.trim())).filter(id => id > 0n);
  })(),
  tz: optional('TZ', 'Asia/Shanghai'),
  dataDir: resolve(optional('DATA_DIR', '/app/data')),
  stateEmojiEnabled: optionalBool('STATE_EMOJI_ENABLED', true),
  alertCheckIntervalSec: optionalNum('ALERT_CHECK_INTERVAL_SEC', 60),
  openclawBinary: optional('OPENCLAW_BINARY', 'openclaw'),
};
