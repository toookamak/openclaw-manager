import { Bot, session } from 'grammy';
import pino from 'pino';
import { config } from './config/env';
import { initDb } from './storage/db';
import { BotContext, SessionData } from './types/bot';
import { registerCommands } from './bot/commands';
import { registerCallbacks } from './bot/callbacks';
import { initAlertService, runAlertCheck } from './services/alert-service';
import { initApprovalService } from './services/approval-service';
import { connectionService } from './services/connection-service';
import { detectDoctorRepairArg } from './openclaw/detect';
import { settingsService } from './services/settings-service';

const logger = pino({ name: 'openclaw-manager' });

function initialSession(): SessionData {
  return {};
}

function scheduleNextCheck(): void {
  const interval = settingsService.getAlertInterval() * 1000;
  setTimeout(() => {
    runAlertCheck()
      .catch(err => logger.error({ err }, 'Alert check failed'))
      .finally(() => scheduleNextCheck());
  }, interval);
}

async function main(): Promise<void> {
  logger.info('Starting OpenClaw Manager Bot...');

  try {
    initDb();
    logger.info('SQLite initialized');
  } catch (err) {
    logger.error({ err }, 'Failed to init SQLite');
    process.exit(1);
  }

  await connectionService.init();

  if (!connectionService.hasConnection()) {
    logger.info('No saved connection, attempting auto-discovery...');
    const result = await connectionService.autoDiscoverAndConnect();
    if (result.success) {
      logger.info({ label: result.label }, 'Auto-discovery successful');
    } else {
      logger.warn('Auto-discovery failed, bot will start without connection');
    }
  }

  if (connectionService.hasConnection()) {
    const profile = connectionService.getProfile();
    if (profile?.type === 'local-cli') {
      await detectDoctorRepairArg();
    }
  }

  const bot = new Bot<BotContext>(config.botToken);
  bot.use(session({ initial: initialSession }));

  initAlertService(bot);
  initApprovalService(bot);

  registerCommands(bot);
  registerCallbacks(bot);

  bot.catch((err) => {
    logger.error({ err: err.error }, 'Bot error');
  });

  scheduleNextCheck();

  logger.info('Bot starting...');
  bot.start({
    onStart: () => logger.info('Bot started successfully'),
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error');
  process.exit(1);
});
