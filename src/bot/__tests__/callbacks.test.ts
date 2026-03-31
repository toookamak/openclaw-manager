jest.mock('../../config/env', () => ({
  config: {
    adminTelegramIds: [BigInt(1)],
    tz: 'Asia/Shanghai',
  },
}));

jest.mock('../../openclaw/commands', () => ({
  openclawCommands: {
    modelsSet: jest.fn().mockResolvedValue({
      code: 0,
      output: '```json\n{"model":"gpt-4o","status":"ok"}\n```',
    }),
    backupRestore: jest.fn().mockResolvedValue({
      code: 0,
      output: '```json\n{"archive":"backup-001.tar.gz","result":"restored"}\n```',
    }),
    modelsList: jest.fn().mockResolvedValue({ models: [] }),
  },
}));

jest.mock('../../storage/repos/audit-log-repo', () => ({
  auditLogRepo: {
    log: jest.fn(),
    recent: jest.fn().mockReturnValue([]),
    errors: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../services/status-service', () => ({ statusService: {} }));
jest.mock('../../services/health-service', () => ({ healthService: {} }));
jest.mock('../../services/model-service', () => ({ modelService: {} }));
jest.mock('../../services/settings-service', () => ({ settingsService: { getStateEmojiEnabled: jest.fn(), setStateEmojiEnabled: jest.fn(), getAlertInterval: jest.fn() } }));
jest.mock('../../services/connectivity-service', () => ({ connectivityService: {} }));
jest.mock('../../services/doctor-service', () => ({ doctorService: {} }));
jest.mock('../../services/cron-service', () => ({ cronService: {} }));
jest.mock('../../services/backup-service', () => ({ backupService: {} }));
jest.mock('../../services/log-service', () => ({ logService: {} }));
jest.mock('../../services/approval-service', () => ({ approvalService: {} }));
jest.mock('../../services/restart-service', () => ({ restartService: {} }));
jest.mock('../../services/connection-service', () => ({
  connectionService: {
    getProfile: jest.fn(),
    setProfile: jest.fn(),
    reset: jest.fn(),
    autoDiscoverAndConnect: jest.fn(),
  },
}));
jest.mock('../../openclaw/discovery', () => ({
  discoverDockerContainers: jest.fn(),
  discoverLocalCli: jest.fn(),
  discoverHttpEndpoints: jest.fn(),
}));

import { registerCallbacks } from '../callbacks';
import { openclawCommands } from '../../openclaw/commands';

function createBotHarness() {
  const callbackHandlers: Array<{ pattern: RegExp; handler: (ctx: any) => Promise<void> }> = [];
  const messageHandlers: Array<{ event: string; handler: (ctx: any) => Promise<void> }> = [];
  const bot = {
    callbackQuery: jest.fn((pattern: RegExp, handler: (ctx: any) => Promise<void>) => {
      callbackHandlers.push({ pattern, handler });
    }),
    on: jest.fn((event: string, handler: (ctx: any) => Promise<void>) => {
      messageHandlers.push({ event, handler });
    }),
  } as any;

  registerCallbacks(bot);

  return {
    callbackHandlers,
    messageHandlers,
  };
}

function createContext(overrides: Partial<any> = {}) {
  return {
    from: { id: 1 },
    chat: { id: 2, type: 'private' },
    session: {},
    match: [],
    answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('registerCallbacks', () => {
  it('formats model set callback results through templates', async () => {
    const { callbackHandlers } = createBotHarness();
    const handler = callbackHandlers.find(item => item.pattern.toString() === /^model:confirm:set:(.+)$/.toString());
    const ctx = createContext({
      match: ['model:confirm:set:gpt-4o', 'gpt-4o'],
    });

    await handler!.handler(ctx);

    expect(openclawCommands.modelsSet).toHaveBeenCalledWith('gpt-4o');
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('切换模型');
    expect(text).toContain('model: gpt-4o');
    expect(text).not.toContain('```');
  });

  it('formats backup restore replies from pending text actions through templates', async () => {
    const { messageHandlers } = createBotHarness();
    const handler = messageHandlers.find(item => item.event === 'message:text');
    const ctx = createContext({
      session: {
        pendingAction: {
          scope: 'backup',
          action: 'restore_archive',
          expiresAt: Date.now() + 60_000,
        },
      },
      message: { text: 'backup-001.tar.gz' },
    });

    await handler!.handler(ctx);

    expect(openclawCommands.backupRestore).toHaveBeenCalledWith('backup-001.tar.gz');
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text] = ctx.reply.mock.calls[0];
    expect(text).toContain('恢复备份 backup-001.tar.gz');
    expect(text).toContain('archive: backup-001.tar.gz');
    expect(text).not.toContain('```');
  });
});
