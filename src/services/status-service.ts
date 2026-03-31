import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';
import { cacheRepo } from '../storage/repos/cache-repo';

const STATUS_OVERVIEW_TTL_MS = 15_000;

export const statusService = {
  async overview() {
    const cached = cacheRepo.getFresh('status:overview', STATUS_OVERVIEW_TTL_MS);
    if (cached) return cached;

    const res = await openclawCommands.status(false, false);
    const e = res.running ? emoji('running') : emoji('fail');
    const text = `${e ? `${e} ` : ''}${formatOutput(res.raw || '未连接 OpenClaw。', '状态概览')}`;
    cacheRepo.set('status:overview', text);
    return text;
  },

  async full() {
    const res = await openclawCommands.status(true, false);
    return formatOutput(res.raw || '未连接 OpenClaw。', '完整状态');
  },

  async deep() {
    const res = await openclawCommands.status(false, true);
    return formatOutput(res.raw || '未连接 OpenClaw。', '深度状态');
  },
};
