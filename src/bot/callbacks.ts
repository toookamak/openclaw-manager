import { Bot } from 'grammy';
import { BotContext } from '../types/bot';
import { config } from '../config/env';
import { menus } from './menus';
import { statusService } from '../services/status-service';
import { healthService } from '../services/health-service';
import { modelService } from '../services/model-service';
import { settingsService } from '../services/settings-service';
import { connectivityService } from '../services/connectivity-service';
import { doctorService } from '../services/doctor-service';
import { cronService } from '../services/cron-service';
import { backupService } from '../services/backup-service';
import { logService } from '../services/log-service';
import { approvalService } from '../services/approval-service';
import { restartService } from '../services/restart-service';
import { auditLogRepo } from '../storage/repos/audit-log-repo';
import { openclawCommands } from '../openclaw/commands';

function isAdmin(ctx: BotContext): boolean {
  return BigInt(ctx.from?.id ?? 0) === config.adminTelegramId;
}

async function reply(ctx: BotContext, text: string, replyMarkup?: unknown): Promise<void> {
  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: replyMarkup as never,
    });
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: replyMarkup as never });
  }
}

async function ack(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch {
    // ignore
  }
}

export function registerCallbacks(bot: Bot<BotContext>): void {
  bot.callbackQuery(/^menu:open:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const scope = ctx.match![1];
    if (scope === 'main') {
      await reply(ctx, '**主菜单**', menus.mainMenu());
      return;
    }

    await reply(ctx, `**${scope}**`, menus.getMenuForScope(scope));
  });

  bot.callbackQuery(/^status:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'overview':
        text = await statusService.overview();
        break;
      case 'full':
        text = await statusService.full();
        break;
      case 'deep':
        text = await statusService.deep();
        break;
    }
    await reply(ctx, text, menus.statusMenu());
  });

  bot.callbackQuery(/^health:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'gateway':
        text = await healthService.gatewayHealth();
        break;
      case 'full':
        text = await healthService.fullHealth();
        break;
      case 'errors':
        text = await healthService.recentErrors();
        break;
    }
    await reply(ctx, text, menus.healthMenu());
  });

  bot.callbackQuery(/^model:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'current':
        text = await modelService.current();
        break;
      case 'list':
        await reply(ctx, await modelService.available(), menus.modelMenu());
        return;
      case 'set': {
        const modelsRes = await openclawCommands.modelsList();
        if (modelsRes.models.length === 0) {
          await reply(ctx, '没有可用模型。', menus.modelMenu());
          return;
        }
        await reply(ctx, '选择模型：', menus.modelListMenu(modelsRes.models));
        return;
      }
    }
    await reply(ctx, text, menus.modelMenu());
  });

  bot.callbackQuery(/^model:confirm:set:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.modelMenu());
      return;
    }

    const model = ctx.match![1];
    const text = await modelService.setModel(model);
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'model:set', model, 'success', null);
    await reply(ctx, text, menus.modelMenu());
  });

  bot.callbackQuery(/^settings:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'config':
        text = await settingsService.configSummary();
        break;
      case 'emoji': {
        const current = settingsService.getStateEmojiEnabled();
        settingsService.setStateEmojiEnabled(!current);
        text = !current ? '状态图标已开启。' : '状态图标已关闭。';
        break;
      }
    }
    await reply(ctx, text, menus.settingsMenu());
  });

  bot.callbackQuery(/^conn:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'channels':
        text = await connectivityService.channelsProbe();
        break;
      case 'provider':
        text = await connectivityService.providerProbe();
        break;
      case 'usage':
        text = await connectivityService.usage();
        break;
    }
    await reply(ctx, text, menus.connectivityMenu());
  });

  bot.callbackQuery(/^doctor:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    if (action === 'repair_confirm') {
      await reply(ctx, '确认执行自动修复？', menus.confirmMenu('doctor', 'run', 'repair'));
      return;
    }

    await reply(ctx, await doctorService.diagnose(), menus.doctorMenu());
  });

  bot.callbackQuery(/^doctor:run:repair$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.doctorMenu());
      return;
    }

    const text = await doctorService.repair();
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'doctor:repair', null, 'success', null);
    await reply(ctx, text, menus.doctorMenu());
  });

  bot.callbackQuery(/^cron:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    switch (action) {
      case 'status':
        await reply(ctx, await cronService.status(), menus.cronMenu());
        return;
      case 'list': {
        const result = await cronService.list();
        await reply(ctx, result.text, result.jobs.length > 0 ? menus.cronJobsMenu(result.jobs) : menus.cronMenu());
        return;
      }
    }
  });

  bot.callbackQuery(/^cron:menu:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const jobId = ctx.match![1];
    await reply(ctx, `**Cron 任务**\n\n\`${jobId}\``, menus.cronJobMenu(jobId));
  });

  bot.callbackQuery(/^cron:confirm:(enable|disable|run):(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.cronMenu());
      return;
    }

    const action = ctx.match![1];
    const jobId = ctx.match![2];
    let text = '';
    switch (action) {
      case 'enable':
        text = await cronService.enable(jobId);
        break;
      case 'disable':
        text = await cronService.disable(jobId);
        break;
      case 'run':
        text = await cronService.run(jobId);
        break;
    }
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), `cron:${action}`, jobId, 'success', null);
    await reply(ctx, text, menus.cronJobMenu(jobId));
  });

  bot.callbackQuery(/^cron:run:lastrun:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const jobId = ctx.match![1];
    await reply(ctx, await cronService.lastRun(jobId), menus.cronJobMenu(jobId));
  });

  bot.callbackQuery(/^logs:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'recent':
        text = await logService.recentLogs();
        break;
      case 'errors':
        text = await logService.errorSummary();
        break;
    }
    await reply(ctx, text, menus.logsMenu());
  });

  bot.callbackQuery(/^backup:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.backupMenu());
      return;
    }

    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'create':
        text = await backupService.create();
        break;
      case 'list':
        text = await backupService.list();
        break;
    }
    await reply(ctx, text, menus.backupMenu());
  });

  bot.callbackQuery(/^acl:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';

    switch (action) {
      case 'chatid':
        text = `Chat ID: \`${ctx.chat?.id ?? 0}\``;
        break;
      case 'userid':
        text = `User ID: \`${ctx.from?.id ?? 0}\`\nChat ID: \`${ctx.chat?.id ?? 0}\``;
        break;
      case 'status': {
        const chatId = BigInt(ctx.chat?.id ?? 0);
        text = approvalService.isWhitelisted(chatId) ? '当前群已授权。' : '当前群未授权。';
        break;
      }
      case 'request': {
        const chatId = BigInt(ctx.chat?.id ?? 0);
        const chatTitle = ctx.chat && 'title' in ctx.chat ? (ctx.chat as { title?: string }).title ?? null : null;
        text = await approvalService.requestApproval(chatId, chatTitle, BigInt(ctx.from?.id ?? 0));
        break;
      }
      case 'pending': {
        if (!isAdmin(ctx)) {
          await reply(ctx, '无权限执行该操作。', menus.aclMenu());
          return;
        }

        const groups = approvalService.pendingGroups();
        if (groups.length === 0) {
          text = '当前没有待授权群。';
        } else {
          await reply(ctx, '**待授权群**', menus.pendingGroupsMenu(groups));
          return;
        }
        break;
      }
      case 'whitelist': {
        const list = approvalService.listWhitelist();
        if (list.length === 0) {
          text = '白名单为空。';
          break;
        }
        text = `**白名单**\n\n${list.map(entry => `- \`${entry.chat_id}\` - ${entry.chat_title ?? '未知'}`).join('\n')}`;
        break;
      }
      case 'allow': {
        if (!isAdmin(ctx)) {
          await reply(ctx, '无权限执行该操作。', menus.aclMenu());
          return;
        }
        const chatId = BigInt(ctx.chat?.id ?? 0);
        const chatTitle = ctx.chat && 'title' in ctx.chat ? (ctx.chat as { title?: string }).title ?? null : null;
        approvalService.addWhitelist(chatId, ctx.chat?.type ?? 'group', chatTitle);
        text = '已加入白名单。';
        break;
      }
      case 'remove': {
        if (!isAdmin(ctx)) {
          await reply(ctx, '无权限执行该操作。', menus.aclMenu());
          return;
        }
        const chatId = BigInt(ctx.chat?.id ?? 0);
        approvalService.removeWhitelist(chatId);
        text = '已从白名单移除。';
        break;
      }
    }

    await reply(ctx, text, menus.aclMenu());
  });

  bot.callbackQuery(/^acl:approve:(-?\d+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) return;
    const chatId = BigInt(ctx.match![1]);
    approvalService.approveGroup(chatId);
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'success', null);
    await reply(ctx, '已批准授权。', menus.aclMenu());
  });

  bot.callbackQuery(/^acl:reject:(-?\d+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) return;
    const chatId = BigInt(ctx.match![1]);
    approvalService.rejectGroup(chatId);
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:reject', String(chatId), 'success', null);
    await reply(ctx, '已拒绝授权。', menus.aclMenu());
  });

  bot.callbackQuery(/^restart:confirm:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const target = ctx.match![1];
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.restartMenu());
      return;
    }
    await reply(ctx, `确认重启 ${target}？`, menus.confirmMenu('restart', 'run', target));
  });

  bot.callbackQuery(/^restart:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.restartMenu());
      return;
    }

    const target = ctx.match![1];
    let text = '';
    switch (target) {
      case 'openclaw':
        text = await restartService.openclaw();
        break;
      case 'gateway':
        text = await restartService.gateway();
        break;
    }
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), `restart:${target}`, null, 'success', null);
    await reply(ctx, text, menus.restartMenu());
  });
}
