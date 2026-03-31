import { getDb } from '../db';

export interface PendingGroup {
  chat_id: number;
  chat_title: string | null;
  requested_by: number;
  requested_at: string;
}

export const pendingGroupsRepo = {
  add(chatId: bigint, chatTitle: string | null, requestedBy: bigint): void {
    getDb().prepare(
      'INSERT OR REPLACE INTO pending_groups (chat_id, chat_title, requested_by, requested_at) VALUES (?, ?, ?, datetime(\'now\'))'
    ).run(Number(chatId), chatTitle, Number(requestedBy));
  },

  remove(chatId: bigint): void {
    getDb().prepare('DELETE FROM pending_groups WHERE chat_id = ?').run(Number(chatId));
  },

  list(limit = 10): PendingGroup[] {
    return getDb().prepare('SELECT * FROM pending_groups ORDER BY requested_at DESC LIMIT ?').all(limit) as PendingGroup[];
  },

  exists(chatId: bigint): boolean {
    return !!getDb().prepare('SELECT 1 FROM pending_groups WHERE chat_id = ?').get(Number(chatId));
  },
};
