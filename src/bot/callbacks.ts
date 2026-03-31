import { Bot } from 'grammy';
import { BotContext } from '../types/bot';
import { config } from '../config/env';
import { menus } from './menus';
import { templates } from './templates';
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
import { connectionService } from '../services/connection-service';
import { auditLogRepo } from '../storage/repos/audit-log-repo';
import { openclawCommands } from '../openclaw/commands';
import { discoverDockerContainers, discoverLocalCli, discoverHttpEndpoints } from '../openclaw/discovery';
import { friendlyError } from './formatters';

function isAdmin(ctx: BotContext): boolean {
  const userId = BigInt(ctx.from?.id ?? 0);
  return config.adminTelegramIds.includes(userId);
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

async function replyResult(ctx: BotContext, result: { text: string; keyboard: any }): Promise<void> {
  try {
    await ctx.editMessageText(result.text, {
      parse_mode: 'Markdown',
      reply_markup: result.keyboard,
    });
  } catch {
    await ctx.reply(result.text, { parse_mode: 'Markdown', reply_markup: result.keyboard });
  }
}

function actionResult(title: string, code: number, output: string, keyboard: any) {
  const detail = code === 0 ? output : friendlyError(code, output);
  return templates.resultWithKeyboard(title, code, detail, keyboard);
}

async function ack(ctx: BotContext, text = '处理中...'): Promise<void> {
  try {
    await ctx.answerCallbackQuery({ text });
  } catch {
    // ignore
  }
}

export function registerCallbacks(bot: Bot<BotContext>): void {
  bot.callbackQuery(/^menu:open:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx, '');
    const scope = ctx.match![1];
    await reply(ctx, `**${menus.getTitleForScope(scope)}**`, menus.getMenuForScope(scope));
  });

  bot.callbackQuery(/^status:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let result: { text: string; keyboard: any };
    switch (action) {
      case 'overview':
        result = await statusService.overview();
        break;
      case 'full':
        result = await statusService.full();
        break;
      case 'deep':
        result = await statusService.deep();
        break;
      default:
        return;
    }
    await replyResult(ctx, result);
  });

  bot.callbackQuery(/^health:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let result: { text: string; keyboard: any };
    switch (action) {
      case 'gateway':
        result = await healthService.gatewayHealth();
        break;
      case 'full':
        result = await healthService.fullHealth();
        break;
      case 'errors':
        result = await healthService.recentErrors();
        break;
      default:
        return;
    }
    await replyResult(ctx, result);
  });

  bot.callbackQuery(/^model:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    switch (action) {
      case 'current': {
        const result = await modelService.current();
        await replyResult(ctx, result);
        return;
      }
      case 'list': {
        const result = await modelService.available();
        await replyResult(ctx, result);
        return;
      }
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
  });

  bot.callbackQuery(/^model:confirm:set:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.modelMenu());
      return;
    }

    const model = ctx.match![1];
    const res = await openclawCommands.modelsSet(model);
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'model:set', model, result, result === 'failed' ? res.output : null);
    await replyResult(ctx, actionResult('切换模型', res.code, res.output, menus.modelMenu()));
  });

  bot.callbackQuery(/^settings:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let text = '';
    switch (action) {
      case 'config': {
        const result = await settingsService.configSummary();
        await replyResult(ctx, result);
        return;
      }
      case 'emoji': {
        const current = settingsService.getStateEmojiEnabled();
        settingsService.setStateEmojiEnabled(!current);
        text = !current ? '状态图标已开启。' : '状态图标已关闭。';
        break;
      }
      case 'connection': {
        const result = await settingsService.connectionStatus();
        await replyResult(ctx, result);
        return;
      }
      case 'version': {
        const result = await settingsService.openclawVersion();
        await replyResult(ctx, result);
        return;
      }
      case 'alert_interval': {
        const current = settingsService.getAlertInterval();
        text = `当前告警间隔：${current} 秒\n\n请输入新的间隔（秒）：`;
        ctx.session.pendingAction = {
          scope: 'settings',
          action: 'alert_interval',
          expiresAt: Date.now() + 5 * 60 * 1000,
        };
        break;
      }
    }
    await reply(ctx, text, menus.settingsMenu());
  });

  bot.callbackQuery(/^conn:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let result: { text: string; keyboard: any };
    switch (action) {
      case 'channels':
        result = await connectivityService.channelsProbe();
        break;
      case 'provider':
        result = await connectivityService.providerProbe();
        break;
      case 'usage':
        result = await connectivityService.usage();
        break;
      default:
        return;
    }
    await replyResult(ctx, result);
  });

  bot.callbackQuery(/^doctor:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    if (action === 'repair_confirm') {
      await reply(ctx, '确认执行自动修复？', menus.confirmMenu('doctor:run:repair', 'menu:open:doctor'));
      return;
    }

    const result = await doctorService.diagnose();
    await replyResult(ctx, result);
  });

  bot.callbackQuery(/^doctor:run:repair$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.doctorMenu());
      return;
    }

    const res = await openclawCommands.doctorRepair();
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'doctor:repair', null, result, result === 'failed' ? res.output : null);
    await replyResult(ctx, actionResult('Doctor 修复', res.code, res.output, menus.doctorMenu()));
  });

  bot.callbackQuery(/^cron:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    switch (action) {
      case 'status': {
        const result = await cronService.status();
        await replyResult(ctx, result);
        return;
      }
      case 'list': {
        const result = await cronService.list();
        await replyResult(ctx, result);
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
    let code: number;
    let output: string;
    switch (action) {
      case 'enable': {
        const res = await openclawCommands.cronEnable(jobId);
        code = res.code;
        output = res.output;
        break;
      }
      case 'disable': {
        const res = await openclawCommands.cronDisable(jobId);
        code = res.code;
        output = res.output;
        break;
      }
      case 'run': {
        const res = await openclawCommands.cronRun(jobId);
        code = res.code;
        output = res.output;
        break;
      }
      default:
        code = -1;
        output = 'Unknown action';
    }
    const result = code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), `cron:${action}`, jobId, result, result === 'failed' ? output : null);
    const title = action === 'enable'
      ? `启用任务 ${jobId}`
      : action === 'disable'
        ? `禁用任务 ${jobId}`
        : `执行任务 ${jobId}`;
    await replyResult(ctx, actionResult(title, code, output, menus.cronJobMenu(jobId)));
  });

  bot.callbackQuery(/^cron:run:lastrun:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const result = await cronService.lastRun(ctx.match![1]);
    await replyResult(ctx, result);
  });

  bot.callbackQuery(/^logs:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    let result: { text: string; keyboard: any };
    switch (action) {
      case 'recent':
        result = await logService.recentLogs();
        break;
      case 'errors':
        result = await logService.errorSummary();
        break;
      default:
        return;
    }
    await replyResult(ctx, result);
  });

  bot.callbackQuery(/^backup:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.backupMenu());
      return;
    }

    const action = ctx.match![1];
    switch (action) {
      case 'create': {
        const result = await backupService.create();
        auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'backup:create', null, 'success', null);
        await replyResult(ctx, result);
        return;
      }
      case 'list': {
        const result = await backupService.list();
        await replyResult(ctx, result);
        return;
      }
      case 'restore': {
        await reply(ctx, '确认执行恢复操作？恢复将覆盖当前数据。', menus.confirmMenu('backup:confirm:restore', 'menu:open:backup'));
        return;
      }
    }
  });

  bot.callbackQuery(/^backup:menu:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const archive = decodeURIComponent(ctx.match![1]);
    await reply(ctx, `**备份**\n\n\`${archive}\``, menus.backupItemMenu(archive));
  });

  bot.callbackQuery(/^backup:verify:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const archive = decodeURIComponent(ctx.match![1]);
    const result = await backupService.verify(archive);
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'backup:verify', archive, 'success', null);
    await replyResult(ctx, result);
  });

  bot.callbackQuery(/^backup:confirm:restore$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.backupMenu());
      return;
    }
    ctx.session.pendingAction = {
      scope: 'backup',
      action: 'restore_archive',
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    await reply(ctx, '请输入要恢复的备份文件名：', menus.backupMenu());
  });

  bot.callbackQuery(/^backup:run:restore:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.backupMenu());
      return;
    }
    const archive = decodeURIComponent(ctx.match![1]);
    const res = await openclawCommands.backupRestore(archive);
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'backup:restore', archive, result, result === 'failed' ? res.output : null);
    await replyResult(ctx, actionResult(`恢复备份 ${archive}`, res.code, res.output, menus.backupMenu()));
  });

  bot.callbackQuery(/^backup:delete:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.backupMenu());
      return;
    }
    const archive = decodeURIComponent(ctx.match![1]);
    const res = await openclawCommands.backupDelete(archive);
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'backup:delete', archive, result, result === 'failed' ? res.output : null);
    await replyResult(ctx, actionResult(`删除备份 ${archive}`, res.code, res.output, menus.backupMenu()));
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
        const whitelisted = approvalService.isWhitelisted(chatId);
        text = `**群授权状态**\n\n当前群状态: ${whitelisted ? '✅ 已授权' : '❌ 未授权'}`;
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
        } else {
          text = `**白名单**\n\n${list.map(entry => `- ${entry.chat_title ?? '私聊'} (\`${entry.chat_id}\`)`).join('\n')}`;
        }
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
        text = '✅ 已加入白名单。';
        break;
      }
      case 'remove': {
        if (!isAdmin(ctx)) {
          await reply(ctx, '无权限执行该操作。', menus.aclMenu());
          return;
        }
        const chatId = BigInt(ctx.chat?.id ?? 0);
        approvalService.removeWhitelist(chatId);
        text = '✅ 已从白名单移除。';
        break;
      }
    }

    await reply(ctx, text, menus.aclMenu());
  });

  bot.callbackQuery(/^acl:approve:(-?\d+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) return;
    const chatId = BigInt(ctx.match![1]);
    try {
      approvalService.approveGroup(chatId);
      auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'success', null);
      await reply(ctx, '✅ 已批准授权。', menus.aclMenu());
    } catch (err) {
      try {
        auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'failed', String(err));
      } catch {
        // audit log failure should not block error reply
      }
      await reply(ctx, '❌ 批准授权失败，请重试。', menus.aclMenu());
    }
  });

  bot.callbackQuery(/^acl:reject:(-?\d+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) return;
    const chatId = BigInt(ctx.match![1]);
    try {
      approvalService.rejectGroup(chatId);
      auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:reject', String(chatId), 'success', null);
      await reply(ctx, '✅ 已拒绝授权。', menus.aclMenu());
    } catch (err) {
      try {
        auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:reject', String(chatId), 'failed', String(err));
      } catch {
        // audit log failure should not block error reply
      }
      await reply(ctx, '❌ 拒绝授权失败，请重试。', menus.aclMenu());
    }
  });

  bot.callbackQuery(/^restart:confirm:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const target = ctx.match![1];
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.restartMenu());
      return;
    }
    await reply(ctx, `确认重启 ${target}？`, menus.confirmMenu(`restart:run:${target}`, 'menu:open:restart'));
  });

  bot.callbackQuery(/^restart:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) {
      await reply(ctx, '无权限执行该操作。', menus.restartMenu());
      return;
    }

    const target = ctx.match![1];
    let res: { code: number; output: string };
    switch (target) {
      case 'openclaw':
        res = await openclawCommands.openclawRestart();
        break;
      case 'gateway':
        res = await openclawCommands.gatewayRestart();
        break;
      default:
        res = { code: -1, output: 'Unknown target' };
    }
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), `restart:${target}`, null, result, result === 'failed' ? res.output : null);
    const title = target === 'gateway' ? '重启 Gateway' : '重启 OpenClaw';
    await replyResult(ctx, actionResult(title, res.code, res.output, menus.restartMenu()));
  });

  bot.callbackQuery(/^connect:setup:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const mode = ctx.match![1];

    switch (mode) {
      case 'local': {
        const result = await discoverLocalCli();
        if (result) {
          connectionService.setProfile(result.profile);
          await reply(ctx, `✅ 已识别到 OpenClaw 运行环境：${result.label}\n\n是否采用该连接方式？`, menus.confirmMenu('connect:confirm:local', 'menu:open:connection'));
        } else {
          ctx.session.pendingAction = {
            scope: 'connect',
            action: 'local_path',
            expiresAt: Date.now() + 5 * 60 * 1000,
          };
          await reply(ctx, '未自动识别到本机 OpenClaw。\n\n请输入 openclaw 可执行路径（例如：openclaw 或 /usr/local/bin/openclaw）：', menus.connectionSetupMenu());
        }
        break;
      }

      case 'docker': {
        const result = await discoverDockerContainers();
        if (result) {
          connectionService.setProfile(result.profile);
          await reply(ctx, `✅ 已识别到 OpenClaw 运行环境：${result.label}\n\n是否采用该连接方式？`, menus.confirmMenu('connect:confirm:docker', 'menu:open:connection'));
        } else {
          await reply(ctx, '未自动识别到 OpenClaw 容器。\n\n请确保 Docker 可用且容器正在运行，然后重试。', menus.connectionSetupMenu());
        }
        break;
      }

      case 'http': {
        const result = await discoverHttpEndpoints();
        if (result) {
          connectionService.setProfile(result.profile);
          await reply(ctx, `✅ 已识别到 OpenClaw 运行环境：${result.label}\n\n是否采用该连接方式？`, menus.confirmMenu('connect:confirm:http', 'menu:open:connection'));
        } else {
          ctx.session.pendingAction = {
            scope: 'connect',
            action: 'http_url',
            expiresAt: Date.now() + 5 * 60 * 1000,
          };
          await reply(ctx, '未自动识别到 HTTP 端点。\n\n请输入 baseUrl（例如：http://host.docker.internal:18789）：', menus.connectionSetupMenu());
        }
        break;
      }
    }
  });

  bot.callbackQuery(/^connect:confirm:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const profile = connectionService.getProfile();
    if (profile) {
      await reply(ctx, `✅ 已采用连接配置：${profile.type}\n\n后续所有 OpenClaw 操作都将使用此连接。`, menus.connectionStatusMenu());
    } else {
      await reply(ctx, '连接配置未设置，请重新尝试。', menus.connectionSetupMenu());
    }
  });

  bot.callbackQuery(/^connect:rediscover$/, async (ctx: BotContext) => {
    await ack(ctx);
    connectionService.reset();
    const result = await connectionService.autoDiscoverAndConnect();
    if (result.success) {
      await reply(ctx, `✅ 重新发现成功：${result.label}`, menus.connectionStatusMenu());
    } else {
      await reply(ctx, '❌ 未自动识别到 OpenClaw，请选择运行位置：', menus.connectionSetupMenu());
    }
  });

  bot.callbackQuery(/^connect:reset$/, async (ctx: BotContext) => {
    await ack(ctx);
    connectionService.reset();
    await reply(ctx, '✅ 连接配置已重置。', menus.connectionSetupMenu());
  });

  bot.callbackQuery(/^audit:run:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const action = ctx.match![1];
    switch (action) {
      case 'recent': {
        const logs = auditLogRepo.recent(20);
        if (logs.length === 0) {
          await reply(ctx, '暂无审计日志。', menus.auditMenu());
        } else {
          const text = `**最近操作**\n\n${logs.map(l => {
            const time = new Date(l.created_at.replace(' ', 'T') + 'Z').toLocaleString('zh-CN', { timeZone: config.tz });
            const icon = l.result === 'success' ? '✅' : '❌';
            return `${icon} ${time} | ${l.action} | ${l.target ?? '-'} | ${l.result}`;
          }).join('\n')}`;
          await reply(ctx, text, menus.auditMenu());
        }
        break;
      }
      case 'errors': {
        const logs = auditLogRepo.errors(20);
        if (logs.length === 0) {
          await reply(ctx, '暂无失败记录。', menus.auditMenu());
        } else {
          const text = `**失败记录**\n\n${logs.map(l => {
            const time = new Date(l.created_at.replace(' ', 'T') + 'Z').toLocaleString('zh-CN', { timeZone: config.tz });
            return `❌ ${time} | ${l.action} | ${l.target ?? '-'}\n   ${l.message ?? '无错误信息'}`;
          }).join('\n\n')}`;
          await reply(ctx, text, menus.auditMenu());
        }
        break;
      }
    }
  });

  bot.callbackQuery(/^about:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const pkg = require('../../package.json');
    const botVersion = pkg.version || 'v1.0.0';
    const profile = connectionService.getProfile();

    let connectionType = '未配置';
    let connectionDetail = '-';
    if (profile) {
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
    }

    try {
      const status = await openclawCommands.status();
      const text = `**关于 OpenClaw Manager**

Bot 版本: ${botVersion}
OpenClaw 版本: ${status.version ?? '未知'}
运行状态: ${status.running ? '✅ 运行中' : '❌ 异常'}
PID: ${status.pid ?? '未知'}
运行时长: ${status.uptime ?? '未知'}

连接方式: ${connectionType}
连接详情: ${connectionDetail}`;
      await reply(ctx, text, menus.aboutMenu());
    } catch {
      const text = `**关于 OpenClaw Manager**

Bot 版本: ${botVersion}
OpenClaw 版本: 无法获取
运行状态: ❌ 异常

连接方式: ${connectionType}
连接详情: ${connectionDetail}`;
      await reply(ctx, text, menus.aboutMenu());
    }
  });

  bot.on('message:text', async (ctx: BotContext) => {
    const pending = ctx.session.pendingAction;
    if (!pending || pending.expiresAt < Date.now()) {
      ctx.session.pendingAction = undefined;
      return;
    }

    const text = ctx.message?.text?.trim();
    if (!text) return;

    if (text === '/cancel') {
      ctx.session.pendingAction = undefined;
      await ctx.reply('✅ 已取消当前操作。');
      return;
    }

    if (pending.scope === 'connect' && pending.action === 'local_path') {
      ctx.session.pendingAction = undefined;
      const command = text === 'openclaw' ? undefined : text;
      connectionService.setProfile({ type: 'local-cli', command });
      await ctx.reply(`✅ 已设置本机连接：${text}`, { reply_markup: menus.connectionStatusMenu() });
      return;
    }

    if (pending.scope === 'connect' && pending.action === 'http_url') {
      ctx.session.pendingAction = undefined;
      connectionService.setProfile({ type: 'http-api', baseUrl: text });
      await ctx.reply(`✅ 已设置 HTTP 连接：${text}`, { reply_markup: menus.connectionStatusMenu() });
      return;
    }

    if (pending.scope === 'backup' && pending.action === 'restore_archive') {
      ctx.session.pendingAction = undefined;
      const res = await openclawCommands.backupRestore(text);
      const result = res.code === 0 ? 'success' : 'failed';
      auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'backup:restore', text, result, result === 'failed' ? res.output : null);
      const restoreResult = actionResult(`恢复备份 ${text}`, res.code, res.output, menus.backupMenu());
      await ctx.reply(restoreResult.text, { reply_markup: restoreResult.keyboard, parse_mode: 'Markdown' });
      return;
    }

    if (pending.scope === 'settings' && pending.action === 'alert_interval') {
      ctx.session.pendingAction = undefined;
      const seconds = parseInt(text, 10);
      if (Number.isNaN(seconds) || seconds < 10 || seconds > 3600) {
        await ctx.reply('❌ 请输入 10-3600 之间的有效秒数。', { reply_markup: menus.settingsMenu() });
        return;
      }
      settingsService.setAlertInterval(seconds);
      await ctx.reply(`✅ 告警间隔已设置为 ${seconds} 秒。`, { reply_markup: menus.settingsMenu() });
      return;
    }
  });
}
