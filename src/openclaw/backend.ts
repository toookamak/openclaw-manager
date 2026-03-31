import { spawn } from 'child_process';
import http from 'http';
import { ConnectionProfile, OpenClawExecResult } from '../types/openclaw';
import { config } from '../config/env';
import pino from 'pino';

const logger = pino({ name: 'openclaw-backend' });

export interface OpenClawBackend {
  kind: ConnectionProfile['type'];
  profile: ConnectionProfile;
  exec(args: string[], timeoutMs?: number): Promise<OpenClawExecResult>;
}

export class LocalCliBackend implements OpenClawBackend {
  kind = 'local-cli' as const;
  profile: ConnectionProfile;
  private command: string;

  constructor(profile?: ConnectionProfile) {
    this.profile = profile ?? { type: 'local-cli' };
    this.command = (this.profile as { command?: string }).command ?? 'openclaw';
  }

  exec(args: string[], timeoutMs = 30000): Promise<OpenClawExecResult> {
    return new Promise((resolve) => {
      const proc = spawn(this.command, args, {
        env: { ...process.env, PATH: process.env.PATH },
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        logger.warn({ args }, 'CLI timeout');
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? -1, stdout: stdout.trim(), stderr: stderr.trim() });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        logger.error({ args, err: err.message }, 'CLI spawn error');
        resolve({ code: -1, stdout: '', stderr: err.message });
      });
    });
  }
}

export class DockerCliBackend implements OpenClawBackend {
  kind = 'docker-cli' as const;
  profile: ConnectionProfile;
  private container: string;

  constructor(profile: ConnectionProfile) {
    this.profile = profile;
    this.container = (profile as { container: string }).container;
  }

  exec(args: string[], timeoutMs = 30000): Promise<OpenClawExecResult> {
    const dockerArgs = ['exec', this.container, 'openclaw', ...args];
    return new Promise((resolve) => {
      const proc = spawn('docker', dockerArgs, {
        env: { ...process.env, PATH: process.env.PATH },
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        logger.warn({ args }, 'Docker exec timeout');
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? -1, stdout: stdout.trim(), stderr: stderr.trim() });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        logger.error({ args, err: err.message }, 'Docker exec error');
        resolve({ code: -1, stdout: '', stderr: err.message });
      });
    });
  }
}

export class HttpApiBackend implements OpenClawBackend {
  kind = 'http-api' as const;
  profile: ConnectionProfile;
  private baseUrl: string;

  constructor(profile: ConnectionProfile) {
    this.profile = profile;
    this.baseUrl = (profile as { baseUrl: string }).baseUrl.replace(/\/+$/, '');
  }

  async exec(args: string[], timeoutMs = 30000): Promise<OpenClawExecResult> {
    const command = args[0] ?? '';
    const commandArgs = args.slice(1);

    try {
      const response = await this.httpRequest('POST', '/api/v1/exec', {
        command,
        args: commandArgs,
      }, timeoutMs);

      return {
        code: (response.code as number) ?? 0,
        stdout: (response.stdout as string) ?? '',
        stderr: (response.stderr as string) ?? '',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ args, err: message }, 'HTTP API exec error');
      return { code: -1, stdout: '', stderr: message };
    }
  }

  async healthCheck(timeoutMs = 5000): Promise<boolean> {
    try {
      await this.httpRequest('GET', '/health', undefined, timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  private httpRequest(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 5000
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: timeoutMs,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTP request timeout'));
      });

      req.on('error', (err) => reject(err));

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}

export function createBackend(profile: ConnectionProfile): OpenClawBackend {
  switch (profile.type) {
    case 'local-cli':
      return new LocalCliBackend(profile);
    case 'docker-cli':
      return new DockerCliBackend(profile);
    case 'http-api':
      return new HttpApiBackend(profile);
    default:
      throw new Error(`Unknown backend type: ${(profile as { type: string }).type}`);
  }
}
