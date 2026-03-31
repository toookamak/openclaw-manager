export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type BackendKind = 'local-cli' | 'docker-cli' | 'http-api';

export interface LocalCliConfig {
  type: 'local-cli';
  command?: string;
}

export interface DockerCliConfig {
  type: 'docker-cli';
  container: string;
}

export interface HttpApiConfig {
  type: 'http-api';
  baseUrl: string;
}

export type ConnectionProfile = LocalCliConfig | DockerCliConfig | HttpApiConfig;

export interface DiscoveryResult {
  profile: ConnectionProfile;
  label: string;
}

export interface OpenClawExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface OpenClawStatus {
  running: boolean;
  version?: string;
  uptime?: string;
  raw: string;
}

export interface OpenClawHealth {
  healthy: boolean;
  gateway: boolean;
  providers: Record<string, boolean>;
  details: string;
}

export interface ModelInfo {
  provider: string;
  model: string;
  available: boolean;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
}

export interface CronRun {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  output?: string;
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  verified: boolean;
}

export interface BotContext {
  isAdmin: boolean;
  chatId: bigint;
  userId: bigint;
  chatType: string;
}
