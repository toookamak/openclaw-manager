import { Bot } from 'grammy';
import { BotContext } from '../types/bot';
import { config } from '../config/env';
import { menus } from './menus';
import { approvalService } from '../services/approval-service';

export function registerCommands(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx: BotContext) => {
    const chatType = ctx.chat?.type ?? 'unknown';
    await ctx.reply(
      `**OpenClaw 管理工具**\n\n` +
      `使用 /menu 打开菜单模式选择\n` +
      `可从 状态查看、服务控制、管理授权 三种模式进入\n` +
      `使用 /id 查看当前 ID\n` +
      `使用 /ping 检查 Bot 在线状态\n\n` +
      `Chat Type: ${chatType}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('menu', async (ctx: BotContext) => {
    const chatId = BigInt(ctx.chat?.id ?? 0);
    const chatType = ctx.chat?.type ?? 'unknown';
    const userId = BigInt(ctx.from?.id ?? 0);
    const isAdmin = config.adminTelegramIds.includes(userId);

    if (chatType !== 'private' && !approvalService.isWhitelisted(chatId) && !isAdmin) {
      await ctx.reply('当前群未授权，仅可使用 /id 查看群 ID。');
      return;
    }

    await ctx.reply('**菜单模式**', {
      parse_mode: 'Markdown',
      reply_markup: menus.mainMenu(),
    });
  });

  bot.command('id', async (ctx: BotContext) => {
    const chatId = ctx.chat?.id ?? 0;
    const userId = ctx.from?.id ?? 0;
    const chatType = ctx.chat?.type ?? 'unknown';
    await ctx.reply(
      `**ID 信息**\n\n` +
      `Chat ID: \`${chatId}\`\n` +
      `User ID: \`${userId}\`\n` +
      `Chat Type: ${chatType}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('ping', async (ctx: BotContext) => {
    await ctx.reply('Pong! Bot 在线。');
  });
}
