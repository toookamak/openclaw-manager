import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';

export const doctorService = {
  async diagnose() {
    const res = await openclawCommands.doctor();
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, 'Doctor 诊断')}`;
  },

  async repair() {
    const res = await openclawCommands.doctorRepair();
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, 'Doctor 修复')}`;
  },
};
