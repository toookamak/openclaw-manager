import { config } from '../config/env';
import { settingsRepo } from '../storage/repos/settings-repo';

export function formatOutput(text: string, title?: string): string {
  const prefix = title ? `**${title}**\n\n` : '';
  const content = text || '(no output)';
  const wrapped = content.length > 3500 ? content.slice(0, 3500) + '\n...' : content;
  return `${prefix}\`\`\`\n${wrapped}\n\`\`\``;
}

export function emoji(status: 'success' | 'fail' | 'running' | 'warning'): string {
  const stored = settingsRepo.get('state_emoji_enabled');
  const enabled = stored === undefined ? config.stateEmojiEnabled : stored !== 'false';
  if (!enabled) return '';

  switch (status) {
    case 'success':
      return 'OK';
    case 'fail':
      return 'FAIL';
    case 'running':
      return 'RUN';
    case 'warning':
      return 'WARN';
  }
}
