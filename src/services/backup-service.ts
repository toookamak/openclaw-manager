import { emoji, formatOutput } from '../bot/formatters';
import { openclawCommands } from '../openclaw/commands';

export const backupService = {
  async create() {
    const res = await openclawCommands.backupCreate();
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, '创建备份')}`;
  },

  async list() {
    const res = await openclawCommands.backupList();
    if (!res.output) return '未找到备份文件。';
    return formatOutput(res.output, '备份列表');
  },

  async verify(archive: string) {
    const res = await openclawCommands.backupVerify(archive);
    const e = res.code === 0 ? emoji('success') : emoji('fail');
    return `${e ? `${e} ` : ''}${formatOutput(res.output, '校验备份')}`;
  },
};
