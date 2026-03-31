import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';

export const healthService = {
  async gatewayHealth() {
    const res = await openclawCommands.gatewayHealth();
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, 'Gateway 健康')}`;
  },

  async fullHealth() {
    const res = await openclawCommands.healthJson();
    const e = res.healthy ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.details, '全量健康')}`;
  },

  async recentErrors() {
    const logs = await openclawCommands.logs(200, true);
    const lines = logs.output.split('\n').filter((l: string) => {
      const lower = l.toLowerCase();
      return lower.includes('error') || lower.includes('fatal');
    });

    if (lines.length === 0) {
      return `${emoji('success') ? `${emoji('success')} ` : ''}最近没有异常。`;
    }

    return formatOutput(lines.slice(0, 15).join('\n'), '最近异常');
  },
};
