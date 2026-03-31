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
import { sendConnectionStatus } from './services/notification-service';

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

  let connectionEstablished = false;
  if (!connectionService.hasConnection()) {
    logger.info('No saved connection, attempting auto-discovery...');
    const result = await connectionService.autoDiscoverAndConnect();
    if (result.success) {
      logger.info({ label: result.label }, 'Auto-discovery successful');
      connectionEstablished = true;
    } else {
      logger.warn('Auto-discovery failed, bot will start without connection');
    }
  } else {
    connectionEstablished = true;
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
  await bot.start({
    onStart: async () => {
      logger.info('Bot started successfully');
      if (connectionEstablished) {
        await sendConnectionStatus(bot);
      } else {
        for (const adminId of config.adminTelegramIds) {
          try {
            await bot.api.sendMessage(Number(adminId),
              `**OpenClaw 连接未建立**\n\n未检测到 OpenClaw 运行环境。\n请使用 /connect 手动配置连接。`,
              { parse_mode: 'Markdown' }
            );
          } catch {
            // ignore
          }
        }
      }
    },
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error');
  process.exit(1);
});
