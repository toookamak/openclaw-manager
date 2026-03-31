import { statusService } from '../../services/status-service';
import { healthService } from '../../services/health-service';
import { modelService } from '../../services/model-service';
import { doctorService } from '../../services/doctor-service';
import { cronService } from '../../services/cron-service';
import { backupService } from '../../services/backup-service';
import { restartService } from '../../services/restart-service';
import { settingsService } from '../../services/settings-service';
import { connectivityService } from '../../services/connectivity-service';
import { logService } from '../../services/log-service';
import { approvalService } from '../../services/approval-service';

jest.mock('../../openclaw/commands', () => ({
  openclawCommands: {
    status: jest.fn().mockResolvedValue({
      running: true,
      version: 'v1.2.3',
      uptime: '3d 14h',
      pid: '12345',
      code: 0,
      raw: 'Status: Running\nVersion: v1.2.3\nUptime: 3d 14h\nPID: 12345',
    }),
    gatewayHealth: jest.fn().mockResolvedValue({ code: 0, output: 'Gateway OK' }),
    healthJson: jest.fn().mockResolvedValue({
      healthy: true,
      gateway: true,
      code: 0,
      details: '{"healthy":true}',
    }),
    modelsStatus: jest.fn().mockResolvedValue({ code: 0, output: 'Model: gpt-4o' }),
    modelsList: jest.fn().mockResolvedValue({ code: 0, models: ['gpt-4o', 'claude-3'], raw: 'gpt-4o\nclaude-3' }),
    modelsSet: jest.fn().mockResolvedValue({ code: 0, output: 'Model set to gpt-4o' }),
    configFile: jest.fn().mockResolvedValue({ code: 0, output: '/etc/openclaw/config.yaml' }),
    configGet: jest.fn().mockResolvedValue({ code: 0, output: 'value' }),
    channelsStatus: jest.fn().mockResolvedValue({ code: 0, output: 'Channels OK' }),
    statusUsage: jest.fn().mockResolvedValue({ code: 0, output: 'Usage: 50%' }),
    doctor: jest.fn().mockResolvedValue({ code: 0, output: 'All checks passed' }),
    doctorRepair: jest.fn().mockResolvedValue({ code: 0, output: 'Repaired' }),
    cronStatus: jest.fn().mockResolvedValue({ code: 0, output: 'Cron running' }),
    cronList: jest.fn().mockResolvedValue({
      code: 0,
      jobs: [
        { id: 'job-01', name: 'Backup', schedule: '0 2 * * *', enabled: true },
      ],
      raw: 'job-01  Backup  0 2 * * *  enabled',
    }),
    cronEnable: jest.fn().mockResolvedValue({ code: 0, output: 'Enabled' }),
    cronDisable: jest.fn().mockResolvedValue({ code: 0, output: 'Disabled' }),
    cronRun: jest.fn().mockResolvedValue({ code: 0, output: 'Executed' }),
    cronRuns: jest.fn().mockResolvedValue({ code: 0, output: 'Last run: today' }),
    logs: jest.fn().mockResolvedValue({ code: 0, output: '2026-03-31 INFO log\n2026-03-31 ERROR crash' }),
    backupCreate: jest.fn().mockResolvedValue({ code: 0, output: 'Backup created' }),
    backupList: jest.fn().mockResolvedValue({ code: 0, output: 'backup-001.tar.gz\nbackup-002.tar.gz' }),
    backupVerify: jest.fn().mockResolvedValue({ code: 0, output: 'Verified' }),
    backupRestore: jest.fn().mockResolvedValue({ code: 0, output: 'Restored' }),
    backupDelete: jest.fn().mockResolvedValue({ code: 0, output: 'Deleted' }),
    gatewayRestart: jest.fn().mockResolvedValue({ code: 0, output: 'Gateway restarted' }),
    openclawRestart: jest.fn().mockResolvedValue({ code: 0, output: 'OpenClaw restarted' }),
  },
}));

jest.mock('../../storage/repos/cache-repo', () => ({
  cacheRepo: {
    get: jest.fn(),
    getFresh: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../storage/repos/settings-repo', () => ({
  settingsRepo: {
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    getAll: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../storage/repos/whitelist-repo', () => ({
  whitelistRepo: {
    isAllowed: jest.fn().mockReturnValue(false),
    add: jest.fn(),
    remove: jest.fn(),
    list: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../storage/repos/pending-groups-repo', () => ({
  pendingGroupsRepo: {
    add: jest.fn(),
    remove: jest.fn(),
    list: jest.fn().mockReturnValue([]),
    exists: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../storage/repos/audit-log-repo', () => ({
  auditLogRepo: {
    log: jest.fn(),
    recent: jest.fn().mockReturnValue([]),
    errors: jest.fn().mockReturnValue([]),
  },
}));

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

jest.mock('../../services/connection-service', () => ({
  connectionService: {
    getProfile: jest.fn().mockReturnValue({ type: 'local-cli', command: 'openclaw' }),
  },
}));

describe('statusService', () => {
  it('returns overview', async () => {
    const result = await statusService.overview();
    expect(result).toContain('状态概览');
  });

  it('returns full status', async () => {
    const result = await statusService.full();
    expect(result).toContain('完整状态');
  });

  it('returns deep status', async () => {
    const result = await statusService.deep();
    expect(result).toContain('深度状态');
  });
});

describe('healthService', () => {
  it('returns gateway health', async () => {
    const result = await healthService.gatewayHealth();
    expect(result).toContain('Gateway 健康');
  });

  it('returns full health', async () => {
    const result = await healthService.fullHealth();
    expect(result).toContain('全量健康');
  });

  it('returns recent errors', async () => {
    const result = await healthService.recentErrors();
    expect(result).toBeDefined();
  });
});

describe('modelService', () => {
  it('returns current model', async () => {
    const result = await modelService.current();
    expect(result).toContain('当前模型');
  });

  it('returns available models', async () => {
    const result = await modelService.available();
    expect(result).toContain('gpt-4o');
    expect(result).toContain('claude-3');
  });

  it('sets model', async () => {
    const result = await modelService.setModel('gpt-4o');
    expect(result).toBeDefined();
  });
});

describe('doctorService', () => {
  it('diagnoses', async () => {
    const result = await doctorService.diagnose();
    expect(result).toContain('Doctor 诊断');
  });

  it('repairs', async () => {
    const result = await doctorService.repair();
    expect(result).toContain('Doctor 修复');
  });
});

describe('cronService', () => {
  it('returns status', async () => {
    const result = await cronService.status();
    expect(result).toContain('定时任务状态');
  });

  it('lists jobs', async () => {
    const result = await cronService.list();
    expect(result.jobs).toHaveLength(1);
    expect(result.text).toContain('job-01');
  });

  it('enables job', async () => {
    const result = await cronService.enable('job-01');
    expect(result).toContain('已启用');
  });

  it('disables job', async () => {
    const result = await cronService.disable('job-01');
    expect(result).toContain('已禁用');
  });

  it('runs job', async () => {
    const result = await cronService.run('job-01');
    expect(result).toContain('执行结果');
  });

  it('gets last run', async () => {
    const result = await cronService.lastRun('job-01');
    expect(result).toContain('最近运行记录');
  });
});

describe('backupService', () => {
  it('creates backup', async () => {
    const result = await backupService.create();
    expect(result).toContain('创建备份');
  });

  it('lists backups', async () => {
    const result = await backupService.list();
    expect(result).toContain('备份列表');
  });

  it('verifies backup', async () => {
    const result = await backupService.verify('backup.tar.gz');
    expect(result).toContain('校验');
  });
});

describe('restartService', () => {
  it('restarts openclaw', async () => {
    const result = await restartService.openclaw();
    expect(result).toContain('重启 OpenClaw');
  });

  it('restarts gateway', async () => {
    const result = await restartService.gateway();
    expect(result).toContain('重启 Gateway');
  });
});

describe('settingsService', () => {
  it('returns config summary', async () => {
    const result = await settingsService.configSummary();
    expect(result).toContain('配置摘要');
  });

  it('gets and sets emoji enabled', () => {
    settingsService.setStateEmojiEnabled(true);
    expect(settingsService.getStateEmojiEnabled()).toBe(true);
  });

  it('gets and sets alert interval', () => {
    const { settingsRepo } = require('../../storage/repos/settings-repo');
    settingsRepo.get.mockReturnValue('120');
    expect(settingsService.getAlertInterval()).toBe(120);
    settingsService.setAlertInterval(300);
    expect(settingsRepo.set).toHaveBeenCalledWith('alert_check_interval_sec', '300');
  });

  it('returns connection status', () => {
    const result = settingsService.connectionStatus();
    expect(result).toContain('local-cli');
  });
});

describe('connectivityService', () => {
  it('probes channels', async () => {
    const result = await connectivityService.channelsProbe();
    expect(result).toContain('通道连通性');
  });

  it('probes provider', async () => {
    const result = await connectivityService.providerProbe();
    expect(result).toContain('Provider 连通性');
  });

  it('gets usage', async () => {
    const result = await connectivityService.usage();
    expect(result).toContain('Usage 状态');
  });
});

describe('logService', () => {
  it('returns recent logs', async () => {
    const result = await logService.recentLogs();
    expect(result).toBeDefined();
  });

  it('returns error summary', async () => {
    const result = await logService.errorSummary();
    expect(result).toBeDefined();
  });
});

describe('approvalService', () => {
  it('checks whitelist', () => {
    expect(approvalService.isWhitelisted(BigInt(-1001234567890))).toBe(false);
  });

  it('adds and removes whitelist', () => {
    const { whitelistRepo } = require('../../storage/repos/whitelist-repo');
    whitelistRepo.isAllowed.mockReturnValue(true);
    approvalService.addWhitelist(BigInt(-1001234567890), 'group', 'Test');
    expect(approvalService.isWhitelisted(BigInt(-1001234567890))).toBe(true);
    approvalService.removeWhitelist(BigInt(-1001234567890));
  });

  it('lists whitelist', () => {
    expect(Array.isArray(approvalService.listWhitelist())).toBe(true);
  });

  it('returns pending groups', () => {
    expect(Array.isArray(approvalService.pendingGroups())).toBe(true);
  });
});
