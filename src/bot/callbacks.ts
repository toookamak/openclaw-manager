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
import { connectionService } from '../services/connection-service';
import { auditLogRepo } from '../storage/repos/audit-log-repo';
import { openclawCommands } from '../openclaw/commands';
import { discoverDockerContainers, discoverLocalCli, discoverHttpEndpoints } from '../openclaw/discovery';

function parseBackupList(output: string): string[] {
  const lines = output.split('\n').filter(l => l.trim());
  const archives: string[] = [];
  for (const line of lines) {
    const match = line.match(/(\S+\.tar\.gz|\S+\.zip|\S+\.bak)/i);
    if (match) {
      archives.push(match[1]);
    }
  }
  return archives.length > 0 ? archives : lines.map(l => l.trim().split(/\s+/)[0]).filter(Boolean);
}

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
    await reply(ctx, `**${menus.getTitleForScope(scope)}**`, menus.getMenuForScope(scope));
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
    const res = await openclawCommands.modelsSet(model);
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'model:set', model, result, result === 'failed' ? res.output : null);
    await reply(ctx, res.output, menus.modelMenu());
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
      case 'connection':
        text = `**连接状态**\n\n${settingsService.connectionStatus()}`;
        break;
      case 'version':
        text = await settingsService.openclawVersion();
        break;
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
      await reply(ctx, '确认执行自动修复？', menus.confirmMenu('doctor:run:repair', 'menu:open:doctor'));
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

    const res = await openclawCommands.doctorRepair();
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'doctor:repair', null, result, result === 'failed' ? res.output : null);
    const e = res.code === 0 ? '✅' : '❌';
    await reply(ctx, `${e} Doctor 修复\n\n${res.output}`, menus.doctorMenu());
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
    await reply(ctx, output, menus.cronJobMenu(jobId));
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
    let res: { code: number; output: string };
    switch (action) {
      case 'create': {
        res = await openclawCommands.backupCreate();
        const result = res.code === 0 ? 'success' : 'failed';
        auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'backup:create', null, result, result === 'failed' ? res.output : null);
        break;
      }
      case 'list': {
        const listRes = await openclawCommands.backupList();
        if (listRes.code === 0 && listRes.output) {
          const archives = parseBackupList(listRes.output);
          if (archives.length > 0) {
            await reply(ctx, '**备份列表**\n\n选择备份进行操作：', menus.backupListMenu(archives));
            return;
          }
        }
        await reply(ctx, listRes.output || '未找到备份文件。', menus.backupMenu());
        return;
      }
      case 'restore': {
        await reply(ctx, '确认执行恢复操作？恢复将覆盖当前数据。', menus.confirmMenu('backup:confirm:restore', 'menu:open:backup'));
        return;
      }
      default:
        res = { code: -1, output: 'Unknown action' };
    }
    await reply(ctx, res.output, menus.backupMenu());
  });

  bot.callbackQuery(/^backup:menu:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const archive = decodeURIComponent(ctx.match![1]);
    await reply(ctx, `**备份**\n\n\`${archive}\``, menus.backupItemMenu(archive));
  });

  bot.callbackQuery(/^backup:verify:(.+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    const archive = decodeURIComponent(ctx.match![1]);
    const res = await openclawCommands.backupVerify(archive);
    const result = res.code === 0 ? 'success' : 'failed';
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'backup:verify', archive, result, result === 'failed' ? res.output : null);
    const e = res.code === 0 ? '✅' : '❌';
    await reply(ctx, `${e} 备份校验\n\n${res.output}`, menus.backupItemMenu(archive));
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
    const e = res.code === 0 ? '✅' : '❌';
    await reply(ctx, `${e} 备份恢复\n\n${res.output}`, menus.backupMenu());
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
    const e = res.code === 0 ? '✅' : '❌';
    await reply(ctx, `${e} 备份删除\n\n${res.output}`, menus.backupMenu());
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
    try {
      approvalService.approveGroup(chatId);
      auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'success', null);
      await reply(ctx, '已批准授权。', menus.aclMenu());
    } catch (err) {
      try {
        auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'failed', String(err));
      } catch {
        // audit log failure should not block error reply
      }
      await reply(ctx, '批准授权失败，请重试。', menus.aclMenu());
    }
  });

  bot.callbackQuery(/^acl:reject:(-?\d+)$/, async (ctx: BotContext) => {
    await ack(ctx);
    if (!isAdmin(ctx)) return;
    const chatId = BigInt(ctx.match![1]);
    try {
      approvalService.rejectGroup(chatId);
      auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:reject', String(chatId), 'success', null);
      await reply(ctx, '已拒绝授权。', menus.aclMenu());
    } catch (err) {
      try {
        auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:reject', String(chatId), 'failed', String(err));
      } catch {
        // audit log failure should not block error reply
      }
      await reply(ctx, '拒绝授权失败，请重试。', menus.aclMenu());
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
    await reply(ctx, res.output, menus.restartMenu());
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
      const e = res.code === 0 ? '✅' : '❌';
      await ctx.reply(`${e} 备份恢复\n\n${res.output}`, { reply_markup: menus.backupMenu() });
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
