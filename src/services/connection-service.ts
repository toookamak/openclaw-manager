import { settingsRepo } from '../storage/repos/settings-repo';
import { ConnectionProfile, BackendKind } from '../types/openclaw';
import { createBackend, OpenClawBackend } from '../openclaw/backend';
import { discoverBestConnection } from '../openclaw/discovery';
import pino from 'pino';

const logger = pino({ name: 'openclaw-connection' });

const PROFILE_KEY = 'openclaw_connection_profile';

class ConnectionService {
  private activeBackend: OpenClawBackend | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    const saved = settingsRepo.get(PROFILE_KEY);
    if (saved) {
      try {
        const profile: ConnectionProfile = JSON.parse(saved);
        this.activeBackend = createBackend(profile);
        logger.info({ type: profile.type }, 'Loaded saved connection profile');
      } catch (err) {
        logger.error({ err }, 'Failed to parse saved connection profile');
      }
    }

    this.initialized = true;
  }

  getBackend(): OpenClawBackend | null {
    return this.activeBackend;
  }

  hasConnection(): boolean {
    return this.activeBackend !== null;
  }

  async autoDiscoverAndConnect(): Promise<{ success: boolean; label?: string }> {
    const result = await discoverBestConnection();
    if (!result) {
      return { success: false };
    }

    this.activeBackend = createBackend(result.profile);
    this.saveProfile(result.profile);
    logger.info({ type: result.profile.type }, 'Auto-discovered and connected');
    return { success: true, label: result.label };
  }

  setProfile(profile: ConnectionProfile): void {
    this.activeBackend = createBackend(profile);
    this.saveProfile(profile);
    logger.info({ type: profile.type }, 'Connection profile set');
  }

  getProfile(): ConnectionProfile | null {
    return this.activeBackend?.profile ?? null;
  }

  reset(): void {
    this.activeBackend = null;
    settingsRepo.set(PROFILE_KEY, '');
    logger.info('Connection profile reset');
  }

  private saveProfile(profile: ConnectionProfile): void {
    settingsRepo.set(PROFILE_KEY, JSON.stringify(profile));
  }
}

export const connectionService = new ConnectionService();
