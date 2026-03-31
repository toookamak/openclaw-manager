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

export function friendlyError(code: number, output: string): string {
  const lower = output.toLowerCase();
  if (lower.includes('not found') || lower.includes('不存在')) return '未找到指定资源，请检查名称是否正确。';
  if (lower.includes('permission') || lower.includes('权限')) return '权限不足，请检查 OpenClaw 配置。';
  if (lower.includes('timeout') || lower.includes('超时')) return '操作超时，请稍后重试。';
  if (lower.includes('connection') || lower.includes('连接')) return '连接失败，请检查网络或 OpenClaw 状态。';
  return `操作失败（code: ${code}）\n\n${output.slice(0, 200)}`;
}
