import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';
import { auditLogRepo } from '../storage/repos/audit-log-repo';

export const logService = {
  async recentLogs(limit = 200) {
    const res = await openclawCommands.logs(limit);
    return formatOutput(res.output, `最近日志（${limit} 行）`);
  },

  async errorSummary() {
    const res = await openclawCommands.logs(500, true);
    const lines = res.output.split('\n').filter((l: string) => {
      const lower = l.toLowerCase();
      return lower.includes('error') || lower.includes('warn') || lower.includes('fatal');
    });

    if (lines.length === 0) {
      return `${emoji('success') ? `${emoji('success')} ` : ''}最近没有错误或告警。`;
    }

    return formatOutput(lines.slice(0, 20).join('\n'), '错误摘要');
  },

  async auditLogs(limit = 10) {
    const logs = auditLogRepo.recent(limit);
    if (logs.length === 0) return '没有审计日志。';

    const lines = logs.map(l => {
      const time = l.created_at.slice(5, 16);
      return `${time} | ${l.action} | ${l.result} | ${l.message ?? ''}`;
    });

    return formatOutput(lines.join('\n'), '审计日志');
  },
};
