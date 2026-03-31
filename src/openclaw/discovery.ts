import { spawn } from 'child_process';
import http from 'http';
import { ConnectionProfile, DiscoveryResult } from '../types/openclaw';
import pino from 'pino';

const logger = pino({ name: 'openclaw-discovery' });

const LOCAL_CLI_CANDIDATES = [
  'openclaw',
  '/usr/local/bin/openclaw',
  '/usr/bin/openclaw',
  '/opt/openclaw/openclaw',
];

const HTTP_ENDPOINTS = [
  'http://127.0.0.1:18789',
  'http://localhost:18789',
  'http://host.docker.internal:18789',
];

function execCommand(command: string, args: string[], timeoutMs = 5000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      env: { ...process.env, PATH: process.env.PATH },
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    const timer = setTimeout(() => { proc.kill('SIGTERM'); }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    proc.on('error', () => {
      clearTimeout(timer);
      resolve({ code: -1, stdout: '', stderr: 'command not found' });
    });
  });
}

function httpGet(url: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        timeout: timeoutMs,
      };

      const req = http.request(options, (res) => {
        res.resume();
        res.on('end', () => {
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        });
      });

      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

export async function discoverLocalCli(): Promise<DiscoveryResult | null> {
  for (const candidate of LOCAL_CLI_CANDIDATES) {
    try {
      const result = await execCommand(candidate, ['status'], 5000);
      if (result.code === 0) {
        logger.info({ command: candidate }, 'Discovered local-cli');
        return {
          profile: { type: 'local-cli', command: candidate === 'openclaw' ? undefined : candidate },
          label: `本机 CLI (${candidate})`,
        };
      }
    } catch {
      // continue to next candidate
    }
  }
  return null;
}

export async function discoverDockerContainers(): Promise<DiscoveryResult | null> {
  try {
    const psResult = await execCommand('docker', ['ps', '--format', '{{.Names}}\t{{.Image}}\t{{.Labels}}'], 5000);
    if (psResult.code !== 0) return null;

    const lines = psResult.stdout.split('\n').filter(l => l.trim());
    const candidates: Array<{ name: string; image: string; labels: string }> = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const [name, image, labels = ''] = parts;
      if (name.toLowerCase().includes('openclaw') ||
          image.toLowerCase().includes('openclaw') ||
          labels.toLowerCase().includes('openclaw')) {
        candidates.push({ name, image, labels });
      }
    }

    for (const candidate of candidates) {
      try {
        const result = await execCommand('docker', ['exec', candidate.name, 'openclaw', 'status'], 5000);
        if (result.code === 0) {
          logger.info({ container: candidate.name }, 'Discovered docker-cli');
          return {
            profile: { type: 'docker-cli', container: candidate.name },
            label: `Docker 容器 ${candidate.name}`,
          };
        }
      } catch {
        // continue to next candidate
      }
    }
  } catch {
    // docker not available
  }

  return null;
}

export async function discoverHttpEndpoints(): Promise<DiscoveryResult | null> {
  for (const endpoint of HTTP_ENDPOINTS) {
    const healthy = await httpGet(`${endpoint}/health`, 3000);
    if (healthy) {
      logger.info({ baseUrl: endpoint }, 'Discovered http-api');
      return {
        profile: { type: 'http-api', baseUrl: endpoint },
        label: `HTTP API (${endpoint})`,
      };
    }
  }
  return null;
}

export async function discoverBestConnection(): Promise<DiscoveryResult | null> {
  logger.info('Starting connection discovery...');

  const local = await discoverLocalCli();
  if (local) return local;

  const docker = await discoverDockerContainers();
  if (docker) return docker;

  const http = await discoverHttpEndpoints();
  if (http) return http;

  logger.info('No connection discovered');
  return null;
}
