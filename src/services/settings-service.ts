import { formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';
import { settingsRepo } from '../storage/repos/settings-repo';
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
};
