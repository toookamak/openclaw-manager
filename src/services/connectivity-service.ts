import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';

export const connectivityService = {
  async channelsProbe() {
    const res = await openclawCommands.channelsStatus(true);
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, '通道连通性')}`;
  },

  async providerProbe() {
    const res = await openclawCommands.modelsStatus(true);
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, 'Provider 连通性')}`;
  },

  async usage() {
    const res = await openclawCommands.statusUsage();
    return formatOutput(res.output, 'Usage 状态');
  },
};
