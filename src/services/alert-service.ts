import { Bot } from 'grammy';
import pino from 'pino';
import { config } from '../config/env';
import { openclawCommands } from '../openclaw/commands';
import { BotContext } from '../types/bot';

const logger = pino({ name: 'alert-service' });

interface AlertState {
  consecutiveFailures: number;
  alerted: boolean;
}

const state: Record<string, AlertState> = {
  connection: { consecutiveFailures: 0, alerted: false },
  gateway: { consecutiveFailures: 0, alerted: false },
  provider: { consecutiveFailures: 0, alerted: false },
};

let botInstance: Bot<BotContext> | null = null;

export function initAlertService(bot: Bot<BotContext>): void {
  botInstance = bot;
}

async function sendAlert(message: string): Promise<void> {
  if (!botInstance) return;
  try {
    await botInstance.api.sendMessage(Number(config.adminTelegramId), `**告警**\n\n${message}`, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error({ err }, 'Failed to send alert');
  }
}

async function sendRecovery(message: string): Promise<void> {
  if (!botInstance) return;
  try {
    await botInstance.api.sendMessage(Number(config.adminTelegramId), `**恢复**\n\n${message}`, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error({ err }, 'Failed to send recovery');
  }
}

export async function runAlertCheck(): Promise<void> {
  try {
    const status = await openclawCommands.status(false, false);
    if (status.running) {
      if (state.connection.alerted) {
        state.connection.alerted = false;
        await sendRecovery('OpenClaw 已恢复正常连接。');
      }
      state.connection.consecutiveFailures = 0;
    } else {
      state.connection.consecutiveFailures++;
      if (state.connection.consecutiveFailures >= 3 && !state.connection.alerted) {
        state.connection.alerted = true;
        await sendAlert('OpenClaw 连续 3 次状态检查失败。');
      }
    }
  } catch {
    state.connection.consecutiveFailures++;
    if (state.connection.consecutiveFailures >= 3 && !state.connection.alerted) {
      state.connection.alerted = true;
      await sendAlert('OpenClaw 连续 3 次状态检查失败。');
    }
  }

  try {
    const gw = await openclawCommands.gatewayHealth();
    if (gw.code === 0) {
      if (state.gateway.alerted) {
        state.gateway.alerted = false;
        await sendRecovery('Gateway 已恢复正常。');
      }
      state.gateway.consecutiveFailures = 0;
    } else {
      state.gateway.consecutiveFailures++;
      if (state.gateway.consecutiveFailures >= 3 && !state.gateway.alerted) {
        state.gateway.alerted = true;
        await sendAlert('Gateway 健康检查连续 3 次失败。');
      }
    }
  } catch {
    state.gateway.consecutiveFailures++;
    if (state.gateway.consecutiveFailures >= 3 && !state.gateway.alerted) {
      state.gateway.alerted = true;
      await sendAlert('Gateway 健康检查连续 3 次失败。');
    }
  }

  try {
    const provider = await openclawCommands.modelsStatus(true);
    if (provider.code === 0) {
      if (state.provider.alerted) {
        state.provider.alerted = false;
        await sendRecovery('Provider 连通性已恢复正常。');
      }
      state.provider.consecutiveFailures = 0;
    } else {
      state.provider.consecutiveFailures++;
      if (state.provider.consecutiveFailures >= 3 && !state.provider.alerted) {
        state.provider.alerted = true;
        await sendAlert('Provider 连通性检查连续 3 次失败。');
      }
    }
  } catch {
    state.provider.consecutiveFailures++;
    if (state.provider.consecutiveFailures >= 3 && !state.provider.alerted) {
      state.provider.alerted = true;
      await sendAlert('Provider 连通性检查连续 3 次失败。');
    }
  }
}
