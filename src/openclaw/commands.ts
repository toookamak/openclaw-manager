import { connectionService } from '../services/connection-service';
import { parseStatus, parseHealthJson, parseModelsList, parseCronJobs } from './parser';
import { doctorRepairArg } from './detect';

async function exec(args: string[]) {
  const backend = connectionService.getBackend();
  if (!backend) {
    return { code: -1, stdout: '', stderr: 'No active OpenClaw connection. Please configure a connection first.' };
  }
  return backend.exec(args);
}

export const openclawCommands = {
  async status(all = false, deep = false) {
    const args = ['status'];
    if (all) args.push('--all');
    if (deep) args.push('--deep');
    const res = await exec(args);
    return { ...parseStatus(res.stdout), code: res.code, raw: res.stdout };
  },

  async gatewayHealth() {
    const res = await exec(['gateway', 'health']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async healthJson() {
    const res = await exec(['health', '--json']);
    return { ...parseHealthJson(res.stdout), code: res.code, raw: res.stdout };
  },

  async modelsStatus(probe = false) {
    const args = ['models', 'status'];
    if (probe) args.push('--probe');
    const res = await exec(args);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async modelsList() {
    const res = await exec(['models', 'list']);
    return { code: res.code, models: parseModelsList(res.stdout), raw: res.stdout };
  },

  async modelsSet(model: string) {
    const res = await exec(['models', 'set', model]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async configFile() {
    const res = await exec(['config', 'file']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async configGet(path: string) {
    const res = await exec(['config', 'get', path]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async channelsStatus(probe = false) {
    const args = ['channels', 'status'];
    if (probe) args.push('--probe');
    const res = await exec(args);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async statusUsage() {
    const res = await exec(['status', '--usage']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async doctor() {
    const res = await exec(['doctor']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async doctorRepair() {
    const res = await exec(['doctor', doctorRepairArg]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronStatus() {
    const res = await exec(['cron', 'status']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronList() {
    const res = await exec(['cron', 'list']);
    return { code: res.code, jobs: parseCronJobs(res.stdout), raw: res.stdout };
  },

  async cronEnable(jobId: string) {
    const res = await exec(['cron', 'enable', jobId]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronDisable(jobId: string) {
    const res = await exec(['cron', 'disable', jobId]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronRun(jobId: string) {
    const res = await exec(['cron', 'run', '--id', jobId]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronRuns(jobId: string, limit = 20) {
    const res = await exec(['cron', 'runs', '--id', jobId, '--limit', String(limit)]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async logs(limit = 200, json = false) {
    const args = ['logs', '--limit', String(limit)];
    if (json) args.push('--json');
    const res = await exec(args);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupCreate() {
    const res = await exec(['backup', 'create', '--verify']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupList() {
    const res = await exec(['backup', 'list']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupVerify(archive: string) {
    const res = await exec(['backup', 'verify', archive]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupRestore(archive: string) {
    const res = await exec(['backup', 'restore', archive]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupDelete(archive: string) {
    const res = await exec(['backup', 'delete', archive]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async gatewayRestart() {
    const res = await exec(['gateway', 'restart']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async openclawRestart() {
    const res = await exec(['restart']);
    return { code: res.code, output: res.stdout || res.stderr };
  },
};
