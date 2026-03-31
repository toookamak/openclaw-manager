import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';

export const modelService = {
  async current() {
    const res = await openclawCommands.modelsStatus(false);
    return templates.modelInfo(res.output);
  },

  async available() {
    const res = await openclawCommands.modelsList();
    return templates.modelList(res.models);
  },

  async setModel(model: string) {
    const res = await openclawCommands.modelsSet(model);
    return templates.genericResult('切换模型', res.code, res.output, 'service-control');
  },
};
