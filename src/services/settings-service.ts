import { InlineKeyboard } from 'grammy';
import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';
import { connectionService } from './connection-service';
import { config } from '../config/env';

export const settingsService = {
  async configSummary() {
    const res = await openclawCommands.configFile();
    return templates.settingsConfig(res.output);
  },

  async configGet(path: string) {
    const res = await openclawCommands.configGet(path);
    return templates.genericResult('配置获取', res.code, res.output, 'management');
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

  async connectionStatus() {
    const profile = connectionService.getProfile();
    if (!profile) return templates.connectionStatus('未配置', '未检测到连接，请使用 /connect 配置。');
    let typeLabel = '';
    let detail = '';
    switch (profile.type) {
      case 'local-cli':
        typeLabel = '本机 CLI';
        detail = (profile as { command?: string }).command ?? 'openclaw';
        break;
      case 'docker-cli':
        typeLabel = 'Docker CLI';
        detail = (profile as { container: string }).container;
        break;
      case 'http-api':
        typeLabel = 'HTTP API';
        detail = (profile as { baseUrl: string }).baseUrl;
        break;
    }
    return templates.connectionStatus(typeLabel, detail);
  },

  async openclawVersion() {
    const res = await openclawCommands.status();
    if (res.version) {
      return templates.genericResult('OpenClaw 版本', 0, `版本: ${res.version}`, 'management');
    }
    return templates.genericResult('OpenClaw 版本', res.code, res.code === 0 ? '版本信息不可用。' : '无法获取版本信息。', 'management');
  },
};

import { settingsRepo } from '../storage/repos/settings-repo';
