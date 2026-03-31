import { formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';

export const cronService = {
  async status() {
    const res = await openclawCommands.cronStatus();
    return formatOutput(res.output, '定时任务状态');
  },

  async list() {
    const res = await openclawCommands.cronList();
    if (res.jobs.length === 0) {
      return { text: '未发现定时任务。', jobs: [] as typeof res.jobs };
    }

    const lines = res.jobs.map(j => {
      const status = j.enabled ? '已启用' : '已禁用';
      return `${status} \`${j.id}\` - ${j.name} (${j.schedule})`;
    });

    return {
      text: `**定时任务列表**\n\n${lines.join('\n')}`,
      jobs: res.jobs,
    };
  },

  async enable(jobId: string) {
    const res = await openclawCommands.cronEnable(jobId);
    return res.code === 0 ? `已启用任务 \`${jobId}\`` : `启用失败：\n${formatOutput(res.output)}`;
  },

  async disable(jobId: string) {
    const res = await openclawCommands.cronDisable(jobId);
    return res.code === 0 ? `已禁用任务 \`${jobId}\`` : `禁用失败：\n${formatOutput(res.output)}`;
  },

  async run(jobId: string) {
    const res = await openclawCommands.cronRun(jobId);
    return formatOutput(res.output, '执行结果');
  },

  async lastRun(jobId: string) {
    const res = await openclawCommands.cronRuns(jobId);
    return formatOutput(res.output, '最近运行记录');
  },
};
