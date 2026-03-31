import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';

export const restartService = {
  async openclaw() {
    const res = await openclawCommands.openclawRestart();
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, '重启 OpenClaw')}`;
  },

  async gateway() {
    const res = await openclawCommands.gatewayRestart();
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, '重启 Gateway')}`;
  },
};
