import { Bot, session } from 'grammy';
import pino from 'pino';
import { config } from './config/env';
import { initDb } from './storage/db';
import { BotContext, SessionData } from './types/bot';
import { registerCommands } from './bot/commands';
import { registerCallbacks } from './bot/callbacks';
import { initAlertService, runAlertCheck } from './services/alert-service';
import { initApprovalService } from './services/approval-service';
import { checkCliExists, detectDoctorRepairArg } from './openclaw/detect';

const logger = pino({ name: 'openclaw-manager' });

function initialSession(): SessionData {
  return {};
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

  const cliExists = await checkCliExists();
  if (!cliExists) {
    logger.error('openclaw CLI not found in PATH or OPENCLAW_BINARY');
    process.exit(1);
  }

  logger.info('openclaw CLI found');
  await detectDoctorRepairArg();

  const bot = new Bot<BotContext>(config.botToken);
  bot.use(session({ initial: initialSession }));

  initAlertService(bot);
  initApprovalService(bot);

  registerCommands(bot);
  registerCallbacks(bot);

  bot.catch((err) => {
    logger.error({ err: err.error }, 'Bot error');
  });

  setInterval(() => {
    runAlertCheck().catch(err => logger.error({ err }, 'Alert check failed'));
  }, config.alertCheckIntervalSec * 1000);

  logger.info('Bot starting...');
  bot.start({
    onStart: () => logger.info('Bot started successfully'),
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error');
  process.exit(1);
});
