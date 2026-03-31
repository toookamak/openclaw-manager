import { formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';
import { settingsRepo } from '../storage/repos/settings-repo';
import { connectionService } from './connection-service';
import { config } from '../config/env';

export const settingsService = {
  async configSummary() {
    const res = await openclawCommands.configFile();
    return formatOutput(res.output, '配置摘要');
  },

  async configGet(path: string) {
    const res = await openclawCommands.configGet(path);
    return formatOutput(res.output);
  },

  getStateEmojiEnabled(): boolean {
    const stored = settingsRepo.get('state_emoji_enabled');
    return stored === undefined ? config.stateEmojiEnabled : stored !== 'false';
  },

  setStateEmojiEnabled(enabled: boolean): void {
    settingsRepo.set('state_emoji_enabled', String(enabled));
  },

  getAlertInterval(): number {
    const stored = settingsRepo.get('alert_check_interval_sec');
    return stored ? parseInt(stored, 10) : config.alertCheckIntervalSec;
  },

  setAlertInterval(seconds: number): void {
    settingsRepo.set('alert_check_interval_sec', String(seconds));
  },

  connectionStatus(): string {
    const profile = connectionService.getProfile();
    if (!profile) return '未配置连接。';
    switch (profile.type) {
      case 'local-cli':
        return `类型: local-cli\n命令: ${(profile as { command?: string }).command ?? 'openclaw'}`;
      case 'docker-cli':
        return `类型: docker-cli\n容器: ${(profile as { container: string }).container}`;
      case 'http-api':
        return `类型: http-api\n地址: ${(profile as { baseUrl: string }).baseUrl}`;
      default:
        return '未知类型。';
    }
  },

  async openclawVersion(): Promise<string> {
    const res = await openclawCommands.status();
    if (res.version) return `OpenClaw 版本: ${res.version}`;
    return res.code === 0 ? '版本信息不可用。' : '无法获取版本信息。';
  },
};
