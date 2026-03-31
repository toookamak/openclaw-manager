import { execCli } from './cli';
import { parseStatus, parseHealthJson, parseModelsList, parseCronJobs } from './parser';
import { doctorRepairArg } from './detect';

export const openclawCommands = {
  async status(all = false, deep = false) {
    const args = ['status'];
    if (all) args.push('--all');
    if (deep) args.push('--deep');
    const res = await execCli(args);
    return { ...parseStatus(res.stdout), code: res.code, raw: res.stdout };
  },

  async gatewayHealth() {
    const res = await execCli(['gateway', 'health']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async healthJson() {
    const res = await execCli(['health', '--json']);
    return { ...parseHealthJson(res.stdout), code: res.code, raw: res.stdout };
  },

  async modelsStatus(probe = false) {
    const args = ['models', 'status'];
    if (probe) args.push('--probe');
    const res = await execCli(args);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async modelsList() {
    const res = await execCli(['models', 'list']);
    return { code: res.code, models: parseModelsList(res.stdout), raw: res.stdout };
  },

  async modelsSet(model: string) {
    const res = await execCli(['models', 'set', model]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async configFile() {
    const res = await execCli(['config', 'file']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async configGet(path: string) {
    const res = await execCli(['config', 'get', path]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async channelsStatus(probe = false) {
    const args = ['channels', 'status'];
    if (probe) args.push('--probe');
    const res = await execCli(args);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async statusUsage() {
    const res = await execCli(['status', '--usage']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async doctor() {
    const res = await execCli(['doctor']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async doctorRepair() {
    const res = await execCli(['doctor', doctorRepairArg]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronStatus() {
    const res = await execCli(['cron', 'status']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronList() {
    const res = await execCli(['cron', 'list']);
    return { code: res.code, jobs: parseCronJobs(res.stdout), raw: res.stdout };
  },

  async cronEnable(jobId: string) {
    const res = await execCli(['cron', 'enable', jobId]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronDisable(jobId: string) {
    const res = await execCli(['cron', 'disable', jobId]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronRun(jobId: string) {
    const res = await execCli(['cron', 'run', '--id', jobId]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async cronRuns(jobId: string, limit = 20) {
    const res = await execCli(['cron', 'runs', '--id', jobId, '--limit', String(limit)]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async logs(limit = 200, json = false) {
    const args = ['logs', '--limit', String(limit)];
    if (json) args.push('--json');
    const res = await execCli(args);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupCreate() {
    const res = await execCli(['backup', 'create', '--verify']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupList() {
    const res = await execCli(['backup', 'list']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async backupVerify(archive: string) {
    const res = await execCli(['backup', 'verify', archive]);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async gatewayRestart() {
    const res = await execCli(['gateway', 'restart']);
    return { code: res.code, output: res.stdout || res.stderr };
  },

  async openclawRestart() {
    const res = await execCli(['restart']);
    return { code: res.code, output: res.stdout || res.stderr };
  },
};
