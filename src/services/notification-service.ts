import { Bot } from 'grammy';
import pino from 'pino';
import { config } from '../config/env';
import { openclawCommands } from '../openclaw/commands';
import { connectionService } from './connection-service';
import { BotContext } from '../types/bot';

const logger = pino({ name: 'notification-service' });

async function broadcastToAdmins(message: string, bot: Bot<BotContext>): Promise<void> {
  for (const adminId of config.adminTelegramIds) {
    try {
      await bot.api.sendMessage(Number(adminId), message, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error({ err, adminId }, 'Failed to send notification');
    }
  }
}

export async function sendRestartNotification(bot: Bot<BotContext>): Promise<void> {
  try {
    const status = await openclawCommands.status();
    const modelRes = await openclawCommands.modelsStatus(false);

    const now = new Date().toLocaleString('zh-CN', { timeZone: config.tz });
    const message = `**OpenClaw 已重启恢复**

运行状态: ✅ 运行中
版本: ${status.version ?? '未知'}
PID: ${status.pid ?? '未知'}
运行时长: ${status.uptime ?? '未知'}
当前模型: ${modelRes.output || '未知'}

恢复时间: ${now}`;

    await broadcastToAdmins(message, bot);
  } catch (err) {
    logger.error({ err }, 'Failed to send restart notification');
  }
}

export async function sendConnectionStatus(bot: Bot<BotContext>): Promise<void> {
  const profile = connectionService.getProfile();
  if (!profile) {
    await broadcastToAdmins(
      `**OpenClaw 连接未建立**

未检测到 OpenClaw 运行环境。
请使用 /connect 手动配置连接。`,
      bot
    );
    return;
  }

  try {
    const status = await openclawCommands.status();
    const modelRes = await openclawCommands.modelsStatus(false);

    let connectionType = '';
    let connectionDetail = '';
    switch (profile.type) {
      case 'local-cli':
        connectionType = '本机 CLI';
        connectionDetail = (profile as { command?: string }).command ?? 'openclaw';
        break;
      case 'docker-cli':
        connectionType = 'Docker CLI';
        connectionDetail = (profile as { container: string }).container;
        break;
      case 'http-api':
        connectionType = 'HTTP API';
        connectionDetail = (profile as { baseUrl: string }).baseUrl;
        break;
    }

    const message = `**OpenClaw 连接已建立**

连接方式: ${connectionType}
连接详情: ${connectionDetail}
运行状态: ${status.running ? '✅ 运行中' : '❌ 异常'}
版本: ${status.version ?? '未知'}
PID: ${status.pid ?? '未知'}
当前模型: ${modelRes.output || '未知'}

使用 /status 查看状态，/service 执行操作`;

    await broadcastToAdmins(message, bot);
  } catch (err) {
    logger.error({ err }, 'Failed to send connection status');
    await broadcastToAdmins(
      `**OpenClaw 连接异常**

连接方式: ${profile.type}
但状态检查失败，请手动排查。`,
      bot
    );
  }
}
