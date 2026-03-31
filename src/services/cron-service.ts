import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';

export const cronService = {
  async status() {
    const res = await openclawCommands.cronStatus();
    return templates.cronStatus(res.output);
  },

  async list() {
    const res = await openclawCommands.cronList();
    return templates.cronList(res.jobs);
  },

  async enable(jobId: string) {
    const res = await openclawCommands.cronEnable(jobId);
    return templates.genericResult(`启用任务 ${jobId}`, res.code, res.output, 'service-control');
  },

  async disable(jobId: string) {
    const res = await openclawCommands.cronDisable(jobId);
    return templates.genericResult(`禁用任务 ${jobId}`, res.code, res.output, 'service-control');
  },

  async run(jobId: string) {
    const res = await openclawCommands.cronRun(jobId);
    return templates.genericResult(`执行任务 ${jobId}`, res.code, res.output, 'service-control');
  },

  async lastRun(jobId: string) {
    const res = await openclawCommands.cronRuns(jobId);
    return templates.genericResult(`最近运行 ${jobId}`, res.code, res.output, 'service-control');
  },
};
