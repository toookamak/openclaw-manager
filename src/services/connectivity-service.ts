import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';

export const connectivityService = {
  async channelsProbe() {
    const res = await openclawCommands.channelsStatus(true);
    return templates.connectivityResult('通道连通性', res.code, res.output);
  },

  async providerProbe() {
    const res = await openclawCommands.modelsStatus(true);
    return templates.connectivityResult('Provider 连通性', res.code, res.output);
  },

  async usage() {
    const res = await openclawCommands.statusUsage();
    return templates.connectivityResult('Usage 状态', res.code, res.output);
  },
};
