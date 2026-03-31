import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';

export const modelService = {
  async current() {
    const res = await openclawCommands.modelsStatus(false);
    return formatOutput(res.output, '当前模型');
  },

  async available() {
    const res = await openclawCommands.modelsList();
    if (res.models.length === 0) return '未找到可用模型。';
    return `**可用模型**\n\n${res.models.map(m => `- \`${m}\``).join('\n')}`;
  },

  async setModel(model: string) {
    const res = await openclawCommands.modelsSet(model);
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, '切换模型结果')}`;
  },
};
