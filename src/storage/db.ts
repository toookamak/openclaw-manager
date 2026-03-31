import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config/env';
import { mkdirSync, existsSync } from 'fs';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    if (!existsSync(config.dataDir)) {
      mkdirSync(config.dataDir, { recursive: true });
    }
    db = new Database(join(config.dataDir, 'openclaw-manager.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  database.exec(schema);
}
