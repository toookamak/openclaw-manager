import { getDb } from '../db';

export interface AuditLog {
  id: number;
  actor_id: number;
  chat_id: number;
  action: string;
  target: string | null;
  result: 'success' | 'failed';
  message: string | null;
  created_at: string;
}

export const auditLogRepo = {
  log(actorId: bigint, chatId: bigint, action: string, target: string | null, result: 'success' | 'failed', message: string | null): void {
    getDb().prepare(
      'INSERT INTO audit_logs (actor_id, chat_id, action, target, result, message, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
    ).run(Number(actorId), Number(chatId), action, target, result, message);
  },

  recent(limit = 20): AuditLog[] {
    return getDb().prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit) as AuditLog[];
  },

  errors(limit = 20): AuditLog[] {
    return getDb().prepare('SELECT * FROM audit_logs WHERE result = ? ORDER BY created_at DESC LIMIT ?').all('failed', limit) as AuditLog[];
  },
};
