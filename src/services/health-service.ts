import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';

export const healthService = {
  async gatewayHealth() {
    const res = await openclawCommands.gatewayHealth();
    return templates.gatewayHealth(res.code, res.output);
  },

  async fullHealth() {
    const res = await openclawCommands.healthJson();
    return templates.fullHealth(res.healthy ? 0 : -1, res.details);
  },

  async recentErrors() {
    const logs = await openclawCommands.logs(200, true);
    const errors = logs.output.split('\n').filter((l: string) => {
      const lower = l.toLowerCase();
      return lower.includes('error') || lower.includes('fatal');
    });
    return templates.recentErrors(errors.slice(0, 15));
  },
};
