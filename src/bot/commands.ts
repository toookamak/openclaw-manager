import { Bot } from 'grammy';
import { BotContext } from '../types/bot';
import { config } from '../config/env';
import { menus } from './menus';
import { approvalService } from '../services/approval-service';

export function registerCommands(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx: BotContext) => {
    await ctx.reply(
      `**OpenClaw 管理工具**\n\n` +
      `快捷命令：\n` +
      `/status — 状态查看（只读）\n` +
      `/service — 服务控制（写操作）\n` +
      `/admin — 管理授权（配置/ACL）\n\n` +
      `辅助命令：\n` +
      `/id — 查看当前 ID\n` +
      `/ping — 检查 Bot 在线\n` +
      `/cancel — 取消当前操作\n` +
      `/connect — 连接管理`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status', async (ctx: BotContext) => {
    await ctx.reply('**状态查看**', {
      parse_mode: 'Markdown',
      reply_markup: menus.statusViewMenu(),
    });
  });

  bot.command('service', async (ctx: BotContext) => {
    const chatId = BigInt(ctx.chat?.id ?? 0);
    const userId = BigInt(ctx.from?.id ?? 0);
    const isAdmin = config.adminTelegramIds.includes(userId);

    if (ctx.chat?.type !== 'private' && !approvalService.isWhitelisted(chatId) && !isAdmin) {
      await ctx.reply('当前群未授权，仅可使用 /id 查看群 ID。');
      return;
    }

    await ctx.reply('**服务控制**', {
      parse_mode: 'Markdown',
      reply_markup: menus.serviceControlMenu(),
    });
  });

  bot.command('admin', async (ctx: BotContext) => {
    const chatId = BigInt(ctx.chat?.id ?? 0);
    const userId = BigInt(ctx.from?.id ?? 0);
    const isAdmin = config.adminTelegramIds.includes(userId);

    if (ctx.chat?.type !== 'private' && !approvalService.isWhitelisted(chatId) && !isAdmin) {
      await ctx.reply('当前群未授权，仅可使用 /id 查看群 ID。');
      return;
    }

    await ctx.reply('**管理授权**', {
      parse_mode: 'Markdown',
      reply_markup: menus.managementMenu(),
    });
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

    await ctx.reply(
      `**快捷命令**\n\n` +
      `/status — 状态查看\n` +
      `/service — 服务控制\n` +
      `/admin — 管理授权\n\n` +
      `或使用下方按钮直接进入：`,
      {
        parse_mode: 'Markdown',
        reply_markup: menus.mainMenu(),
      }
    );
  });

  bot.command('connect', async (ctx: BotContext) => {
    await ctx.reply('**连接管理**', {
      parse_mode: 'Markdown',
      reply_markup: menus.connectionStatusMenu(),
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

  bot.command('cancel', async (ctx: BotContext) => {
    ctx.session.pendingAction = undefined;
    await ctx.reply('✅ 已取消当前操作。');
  });
}
