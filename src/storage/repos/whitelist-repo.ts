import { getDb } from '../db';

export interface WhitelistEntry {
  chat_id: number;
  chat_type: string;
  chat_title: string | null;
  added_at: string;
}

export const whitelistRepo = {
  isAllowed(chatId: bigint): boolean {
    const row = getDb().prepare('SELECT 1 FROM whitelist_chats WHERE chat_id = ?').get(Number(chatId));
    return !!row;
  },

  add(chatId: bigint, chatType: string, chatTitle: string | null): void {
    getDb().prepare(
      'INSERT OR REPLACE INTO whitelist_chats (chat_id, chat_type, chat_title, added_at) VALUES (?, ?, ?, datetime(\'now\'))'
    ).run(Number(chatId), chatType, chatTitle);
  },

  remove(chatId: bigint): void {
    getDb().prepare('DELETE FROM whitelist_chats WHERE chat_id = ?').run(Number(chatId));
  },

  list(): WhitelistEntry[] {
    return getDb().prepare('SELECT * FROM whitelist_chats ORDER BY added_at DESC').all() as WhitelistEntry[];
  },
};
