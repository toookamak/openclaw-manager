import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';

export const doctorService = {
  async diagnose() {
    const res = await openclawCommands.doctor();
    return templates.genericResult('Doctor 诊断', res.code, res.output, 'service-control');
  },

  async repair() {
    const res = await openclawCommands.doctorRepair();
    return templates.genericResult('Doctor 修复', res.code, res.output, 'service-control');
  },
};
