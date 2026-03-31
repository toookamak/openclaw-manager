jest.mock('../../config/env', () => ({
  config: {
    botToken: 'test-token',
    adminTelegramId: BigInt(123456789),
    adminTelegramIds: [BigInt(123456789)],
    tz: 'Asia/Shanghai',
    dataDir: '/tmp/test-data',
    stateEmojiEnabled: true,
    alertCheckIntervalSec: 60,
    openclawBinary: 'openclaw',
  },
}));

import { getDb, initDb } from '../db';
import { settingsRepo } from '../repos/settings-repo';
import { cacheRepo } from '../repos/cache-repo';
import { whitelistRepo } from '../repos/whitelist-repo';
import { pendingGroupsRepo } from '../repos/pending-groups-repo';
import { auditLogRepo } from '../repos/audit-log-repo';

describe('Database', () => {
  it('initializes without error', () => {
    expect(() => initDb()).not.toThrow();
  });

  it('returns the same database instance', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});

describe('settingsRepo', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM settings');
  });

  it('sets and gets a value', () => {
    settingsRepo.set('test_key', 'test_value');
    expect(settingsRepo.get('test_key')).toBe('test_value');
  });

  it('returns undefined for missing key', () => {
    expect(settingsRepo.get('nonexistent')).toBeUndefined();
  });

  it('updates existing key', () => {
    settingsRepo.set('test_key', 'value1');
    settingsRepo.set('test_key', 'value2');
    expect(settingsRepo.get('test_key')).toBe('value2');
  });

  it('gets all settings', () => {
    settingsRepo.set('key_a', 'val_a');
    settingsRepo.set('key_b', 'val_b');
    const all = settingsRepo.getAll();
    expect(all['key_a']).toBe('val_a');
    expect(all['key_b']).toBe('val_b');
  });
});

describe('cacheRepo', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM state_cache');
  });

  it('sets and gets a value', () => {
    cacheRepo.set('cache_key', 'cache_value');
    expect(cacheRepo.get('cache_key')).toBe('cache_value');
  });

  it('returns undefined for missing key', () => {
    expect(cacheRepo.get('nonexistent')).toBeUndefined();
  });

  it('returns fresh value within TTL', () => {
    cacheRepo.set('ttl_key', 'ttl_value');
    expect(cacheRepo.getFresh('ttl_key', 60000)).toBe('ttl_value');
  });

  it('returns undefined for expired value', () => {
    const db = getDb();
    db.prepare("INSERT INTO state_cache (key, value, updated_at) VALUES (?, ?, datetime('now', '-1 day'))")
      .run('expired_key', 'old_value');
    expect(cacheRepo.getFresh('expired_key', 1000)).toBeUndefined();
  });

  it('deletes a value', () => {
    cacheRepo.set('del_key', 'del_value');
    cacheRepo.delete('del_key');
    expect(cacheRepo.get('del_key')).toBeUndefined();
  });
});

describe('whitelistRepo', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM whitelist_chats');
  });

  it('adds and checks whitelist', () => {
    whitelistRepo.add(BigInt(-1001234567890), 'group', 'Test Group');
    expect(whitelistRepo.isAllowed(BigInt(-1001234567890))).toBe(true);
    expect(whitelistRepo.isAllowed(BigInt(-9999999999999))).toBe(false);
  });

  it('removes from whitelist', () => {
    whitelistRepo.add(BigInt(-1001234567890), 'group', 'Test Group');
    whitelistRepo.remove(BigInt(-1001234567890));
    expect(whitelistRepo.isAllowed(BigInt(-1001234567890))).toBe(false);
  });

  it('lists all whitelist entries', () => {
    whitelistRepo.add(BigInt(-1001111111111), 'group', 'Group A');
    whitelistRepo.add(BigInt(-1002222222222), 'group', 'Group B');
    const list = whitelistRepo.list();
    expect(list).toHaveLength(2);
  });

  it('handles negative chat IDs', () => {
    whitelistRepo.add(BigInt(-1009999999999), 'group', null);
    expect(whitelistRepo.isAllowed(BigInt(-1009999999999))).toBe(true);
  });
});

describe('pendingGroupsRepo', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM pending_groups');
  });

  it('adds and checks pending group', () => {
    pendingGroupsRepo.add(BigInt(-1001234567890), 'Pending Group', BigInt(123456789));
    expect(pendingGroupsRepo.exists(BigInt(-1001234567890))).toBe(true);
  });

  it('removes pending group', () => {
    pendingGroupsRepo.add(BigInt(-1001234567890), 'Pending Group', BigInt(123456789));
    pendingGroupsRepo.remove(BigInt(-1001234567890));
    expect(pendingGroupsRepo.exists(BigInt(-1001234567890))).toBe(false);
  });

  it('lists pending groups ordered by time', () => {
    pendingGroupsRepo.add(BigInt(-1001111111111), 'Group A', BigInt(111));
    pendingGroupsRepo.add(BigInt(-1002222222222), 'Group B', BigInt(222));
    const list = pendingGroupsRepo.list();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('handles duplicate adds with replace', () => {
    pendingGroupsRepo.add(BigInt(-1001234567890), 'Old Title', BigInt(123));
    pendingGroupsRepo.add(BigInt(-1001234567890), 'New Title', BigInt(456));
    const list = pendingGroupsRepo.list();
    expect(list).toHaveLength(1);
  });
});

describe('auditLogRepo', () => {
  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM audit_logs');
  });

  it('logs an entry', () => {
    auditLogRepo.log(BigInt(123456789), BigInt(-1001234567890), 'model:set', 'gpt-4o', 'success', null);
    const logs = auditLogRepo.recent(10);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('model:set');
    expect(logs[0].result).toBe('success');
  });

  it('logs a failed entry with message', () => {
    auditLogRepo.log(BigInt(123456789), BigInt(-1001234567890), 'restart:openclaw', null, 'failed', 'CLI timeout');
    const logs = auditLogRepo.recent(10);
    expect(logs[0].result).toBe('failed');
    expect(logs[0].message).toBe('CLI timeout');
  });

  it('queries error logs', () => {
    auditLogRepo.log(BigInt(123), BigInt(-100123), 'action1', null, 'success', null);
    auditLogRepo.log(BigInt(123), BigInt(-100123), 'action2', null, 'failed', 'error');
    const errors = auditLogRepo.errors(10);
    expect(errors).toHaveLength(1);
    expect(errors[0].action).toBe('action2');
  });

  it('limits recent logs', () => {
    for (let i = 0; i < 30; i++) {
      auditLogRepo.log(BigInt(123), BigInt(-100123), `action${i}`, null, 'success', null);
    }
    expect(auditLogRepo.recent(10)).toHaveLength(10);
  });
});
