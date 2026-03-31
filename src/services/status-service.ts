import { InlineKeyboard } from 'grammy';
import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';
import { cacheRepo } from '../storage/repos/cache-repo';

const STATUS_OVERVIEW_TTL_MS = 15_000;

export const statusService = {
  async overview() {
    const cached = cacheRepo.getFresh('status:overview', STATUS_OVERVIEW_TTL_MS);
    if (cached) {
      const result = templates.statusOverview(true, undefined, undefined, cached);
      return result;
    }

    const res = await openclawCommands.status(false, false);
    const result = templates.statusOverview(res.running, res.version, res.uptime, res.raw);
    cacheRepo.set('status:overview', res.raw);
    return result;
  },

  async full() {
    const res = await openclawCommands.status(true, false);
    return templates.statusOverview(res.running, res.version, res.uptime, res.raw);
  },

  async deep() {
    const res = await openclawCommands.status(false, true);
    return templates.statusOverview(res.running, res.version, res.uptime, res.raw);
  },
};
