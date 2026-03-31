import { openclawCommands } from '../openclaw/commands';
import { templates } from '../bot/templates';

export const backupService = {
  async create() {
    const res = await openclawCommands.backupCreate();
    return templates.genericResult('创建备份', res.code, res.output, 'service-control');
  },

  async list() {
    const res = await openclawCommands.backupList();
    if (!res.output) return templates.backupList([]);
    const archives = parseBackupList(res.output);
    return templates.backupList(archives);
  },

  async verify(archive: string) {
    const res = await openclawCommands.backupVerify(archive);
    return templates.genericResult(`校验备份 ${archive}`, res.code, res.output, 'service-control');
  },
};

function parseBackupList(output: string): string[] {
  const lines = output.split('\n').filter(l => l.trim());
  const archives: string[] = [];
  for (const line of lines) {
    const match = line.match(/(\S+\.tar\.gz|\S+\.zip|\S+\.bak)/i);
    if (match) {
      archives.push(match[1]);
    }
  }
  return archives.length > 0 ? archives : lines.map(l => l.trim().split(/\s+/)[0]).filter(Boolean);
}
