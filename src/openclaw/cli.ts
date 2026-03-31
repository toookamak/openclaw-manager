import { spawn } from 'child_process';
import { CliResult } from '../types/openclaw';
import { config } from '../config/env';
import pino from 'pino';

const logger = pino({ name: 'openclaw-cli' });

export async function execCli(args: string[], timeoutMs = 30000): Promise<CliResult> {
  return new Promise((resolve) => {
    const proc = spawn(config.openclawBinary, args, {
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
