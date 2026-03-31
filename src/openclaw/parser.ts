import { CliResult } from '../types/openclaw';

export function parseStatus(output: string): { running: boolean; version?: string; uptime?: string; pid?: string; raw: string } {
  const lines = output.split('\n');
  let running = false;
  let version: string | undefined;
  let uptime: string | undefined;
  let pid: string | undefined;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('running') || lower.includes('active')) running = true;
    if (lower.includes('stopped') || lower.includes('inactive')) running = false;

    const verMatch = line.match(/version[:\s]+([^\s]+)/i);
    if (verMatch) version = verMatch[1];

    const uptimeMatch = line.match(/uptime[:\s]+(.+)/i);
    if (uptimeMatch) uptime = uptimeMatch[1].trim();

    const pidMatch = line.match(/pid[:\s]+(\d+)/i);
    if (pidMatch) pid = pidMatch[1];
  }

  return { running, version, uptime, pid, raw: output };
}

export function parseHealthJson(output: string): { healthy: boolean; gateway: boolean; details: string } {
  try {
    const data = JSON.parse(output);
    const healthy = data.healthy ?? data.status === 'ok';
    const gateway = data.gateway?.healthy ?? (data.gateway?.status === 'ok');
    return { healthy, gateway, details: JSON.stringify(data, null, 2) };
  } catch {
    return { healthy: false, gateway: false, details: output };
  }
}

export function parseModelsList(output: string): string[] {
  const models: string[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
      models.push(trimmed);
    }
  }
  return models;
}

export function parseCronJobs(output: string): Array<{ id: string; name: string; schedule: string; enabled: boolean }> {
  const jobs: Array<{ id: string; name: string; schedule: string; enabled: boolean }> = [];
  for (const line of output.split('\n')) {
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 3) {
      jobs.push({
        id: parts[0],
        name: parts[1],
        schedule: parts[2],
        enabled: !line.toLowerCase().includes('disabled'),
      });
    }
  }
  return jobs;
}

export function parseErrorSummary(output: string): string[] {
  const errors: string[] = [];
  for (const line of output.split('\n')) {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('warn') || lower.includes('fatal')) {
      errors.push(line.trim());
    }
  }
  return errors.slice(0, 20);
}

export function truncateOutput(output: string, maxLen = 3500): string {
  if (output.length <= maxLen) return output;
  return output.slice(0, maxLen) + '\n... (truncated)';
}
