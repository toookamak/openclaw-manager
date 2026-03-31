import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';
import { auditLogRepo } from '../storage/repos/audit-log-repo';

export const logService = {
  async recentLogs(limit = 200) {
    const res = await openclawCommands.logs(limit);
    return templates.genericResult(`最近日志（${limit} 行）`, res.code, res.output, 'status-view');
  },

  async errorSummary() {
    const res = await openclawCommands.logs(500, true);
    const lines = res.output.split('\n').filter((l: string) => {
      const lower = l.toLowerCase();
      return lower.includes('error') || lower.includes('warn') || lower.includes('fatal');
    });

    return templates.recentErrors(lines.slice(0, 20));
  },

  async auditLogs(limit = 10) {
    const logs = auditLogRepo.recent(limit);
    return templates.auditLogs(logs, false);
  },
};
