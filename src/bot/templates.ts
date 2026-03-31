import { InlineKeyboard } from 'grammy';

const TRUNCATE = 3500;

function truncate(text: string): string {
  return text.length > TRUNCATE ? text.slice(0, TRUNCATE) + '\n...' : text;
}

function statusEmoji(running: boolean): string {
  return running ? '✅ 运行中' : '❌ 已停止';
}

function codeEmoji(code: number): string {
  return code === 0 ? '✅' : '❌';
}

function extractKeyValue(raw: string, key: string): string | undefined {
  const regex = new RegExp(`${key}[:\\s=]+(.+)`, 'i');
  const match = raw.match(regex);
  return match ? match[1].trim() : undefined;
}

function cleanOutput(raw: string): string {
  if (!raw || raw.trim() === '') return '(无输出)';
  let cleaned = raw.trim();
  
  // Remove ALL markdown code block markers
  cleaned = cleaned.replace(/```[a-zA-Z]*\s*\n?/g, '');
  cleaned = cleaned.replace(/\n?\s*```/g, '');
  cleaned = cleaned.trim();
  
  // Try to parse as JSON and convert to key-value format
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'object') {
          lines.push(`${key}: ${JSON.stringify(value)}`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
      return lines.join('\n');
    }
  } catch {
    // Not JSON, continue with normal processing
  }
  
  return cleaned || '(无输出)';
}

function formatAsList(raw: string): string {
  const cleaned = cleanOutput(raw);
  if (cleaned === '(无输出)') return cleaned;
  
  const lines = cleaned.split('\n').filter(l => l.trim());
  if (lines.length === 0) return '(无输出)';
  
  // Check if majority of lines are key-value pairs
  let kvCount = 0;
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key && val && key.length < 40 && !key.includes('\n')) {
        kvCount++;
      }
    }
  }
  
  // If more than 40% are key-value pairs, format them nicely
  if (kvCount > lines.length * 0.4) {
    return lines.map(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (key && val && key.length < 40) {
          return `${key}: ${val}`;
        }
      }
      return line;
    }).join('\n');
  }
  
  // For non-key-value output, just return truncated
  return truncate(cleaned);
}

function remainingLines(formatted: string, hiddenKeys: string[]): string {
  if (formatted === '(无输出)') return formatted;
  const hidden = new Set(hiddenKeys.map(key => key.toLowerCase()));
  const lines = formatted
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx <= 0) return line.trim() !== '';
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      return !hidden.has(key);
    });

  return lines.length > 0 ? truncate(lines.join('\n')) : '(无输出)';
}

export const templates = {
  statusOverview(
    running: boolean,
    version?: string,
    uptime?: string,
    raw?: string
  ): { text: string; keyboard: InlineKeyboard } {
    let text = '**状态概览**\n\n';
    text += `运行状态: ${statusEmoji(running)}\n`;
    if (version) text += `版本: ${version}\n`;
    if (uptime) text += `运行时长: ${uptime}\n`;
    if (raw) {
      const pid = extractKeyValue(raw, 'pid');
      const resolvedVersion = version ?? extractKeyValue(raw, 'version');
      const resolvedUptime = uptime ?? extractKeyValue(raw, 'uptime');
      if (pid) text += `PID: ${pid}\n`;
      if (!version && resolvedVersion) text += `版本: ${resolvedVersion}\n`;
      if (!uptime && resolvedUptime) text += `运行时长: ${resolvedUptime}\n`;

      const extra = remainingLines(formatAsList(raw), [
        ...(resolvedVersion ? ['version'] : []),
        ...(resolvedUptime ? ['uptime'] : []),
        ...(pid ? ['pid'] : []),
      ]);
      if (extra !== '(无输出)') {
        text += `\n${extra}`;
      }
    }
    const keyboard = new InlineKeyboard()
      .text('概览', 'status:run:overview')
      .text('完整', 'status:run:full').row()
      .text('深度', 'status:run:deep').row()
      .text('刷新', 'status:run:overview').row()
      .text('返回', 'menu:open:status-view').row();
    return { text, keyboard };
  },

  gatewayHealth(
    code: number,
    output: string
  ): { text: string; keyboard: InlineKeyboard } {
    const emoji = codeEmoji(code);
    const respTime = extractKeyValue(output, 'response') || extractKeyValue(output, 'latency');
    let text = `**Gateway 健康**\n\n状态: ${emoji} ${code === 0 ? '正常' : '异常'}`;
    if (respTime) text += `\n响应时间: ${respTime}`;
    const formatted = formatAsList(output);
    const extra = respTime
      ? remainingLines(formatted, ['response', 'latency'])
      : formatted;
    if (extra !== '(无输出)') {
      text += `\n\n${extra}`;
    }
    const keyboard = new InlineKeyboard()
      .text('Gateway 健康', 'health:run:gateway')
      .text('全量健康', 'health:run:full').row()
      .text('最近异常', 'health:run:errors').row()
      .text('刷新', 'health:run:gateway').row()
      .text('返回', 'menu:open:status-view').row();
    return { text, keyboard };
  },

  fullHealth(
    code: number,
    output: string
  ): { text: string; keyboard: InlineKeyboard } {
    const emoji = codeEmoji(code);
    const text = `**全量健康检查**\n\n状态: ${emoji} ${code === 0 ? '正常' : '异常'}\n\n${formatAsList(output)}`;
    const keyboard = new InlineKeyboard()
      .text('Gateway 健康', 'health:run:gateway')
      .text('全量健康', 'health:run:full').row()
      .text('最近异常', 'health:run:errors').row()
      .text('刷新', 'health:run:full').row()
      .text('返回', 'menu:open:status-view').row();
    return { text, keyboard };
  },

  recentErrors(
    errors: string[]
  ): { text: string; keyboard: InlineKeyboard } {
    let text = `**最近异常**（${errors.length} 条）\n\n`;
    if (errors.length === 0) {
      text += '暂无异常记录';
    } else {
      text += '```\n' + truncate(errors.join('\n')) + '\n```';
    }
    const keyboard = new InlineKeyboard()
      .text('最近日志', 'logs:run:recent')
      .text('错误摘要', 'logs:run:errors').row()
      .text('刷新', 'logs:run:errors').row()
      .text('返回', 'menu:open:status-view').row();
    return { text, keyboard };
  },

  connectivityResult(
    title: string,
    code: number,
    output: string
  ): { text: string; keyboard: InlineKeyboard } {
    const emoji = codeEmoji(code);
    const text = `**${title}**\n\n状态: ${emoji} ${code === 0 ? '连通' : '异常'}\n\n${formatAsList(output)}`;
    const keyboard = new InlineKeyboard()
      .text('通道连通性', 'conn:run:channels')
      .text('Provider', 'conn:run:provider').row()
      .text('Usage', 'conn:run:usage').row()
      .text('返回', 'menu:open:status-view').row();
    return { text, keyboard };
  },

  modelInfo(
    output: string
  ): { text: string; keyboard: InlineKeyboard } {
    const model = extractKeyValue(output, 'model');
    const provider = extractKeyValue(output, 'provider');
    const status = extractKeyValue(output, 'status');
    let text = '**当前模型**\n\n';
    if (model) text += `模型: ${model}\n`;
    if (provider) text += `Provider: ${provider}\n`;
    if (status) text += `状态: ${status}\n`;
    if (!model && !provider && !status) {
      text += formatAsList(output);
    }
    const keyboard = new InlineKeyboard()
      .text('当前模型', 'model:run:current')
      .text('可用模型', 'model:run:list').row()
      .text('切换默认模型', 'model:run:set').row()
      .text('返回', 'menu:open:service-control').row();
    return { text, keyboard };
  },

  modelList(
    models: string[]
  ): { text: string; keyboard: InlineKeyboard } {
    let text = `**可用模型**（${models.length} 个）\n\n`;
    if (models.length === 0) {
      text += '暂无可用模型';
    } else {
      for (let i = 0; i < models.length; i++) {
        text += `${i + 1}. ${models[i]}\n`;
      }
    }
    const keyboard = new InlineKeyboard();
    for (let i = 0; i < models.length; i++) {
      keyboard.text(models[i], `model:confirm:set:${models[i]}`);
      if ((i + 1) % 2 === 0) keyboard.row();
    }
    keyboard.row().text('返回', 'menu:open:service-control');
    return { text, keyboard };
  },

  cronStatus(
    output: string
  ): { text: string; keyboard: InlineKeyboard } {
    const text = `**定时任务状态**\n\n${formatAsList(output)}`;
    const keyboard = new InlineKeyboard()
      .text('任务状态', 'cron:run:status')
      .text('任务列表', 'cron:run:list').row()
      .text('返回', 'menu:open:service-control').row();
    return { text, keyboard };
  },

  cronList(
    jobs: Array<{ id: string; name: string; schedule: string; enabled: boolean }>
  ): { text: string; keyboard: InlineKeyboard } {
    let text = `**定时任务列表**（${jobs.length} 个）\n\n`;
    if (jobs.length === 0) {
      text += '暂无定时任务';
    } else {
      for (const job of jobs) {
        const state = job.enabled ? '✅' : '❌';
        text += `${state} **${job.name}** — ${job.schedule}\n`;
      }
    }
    const keyboard = new InlineKeyboard();
    for (const job of jobs) {
      const state = job.enabled ? '开' : '关';
      keyboard.text(`[${state}] ${job.name}`, `cron:menu:${job.id}`).row();
    }
    keyboard.text('返回', 'menu:open:service-control').row();
    return { text, keyboard };
  },

  cronJobMenu(
    jobId: string
  ): { text: string; keyboard: InlineKeyboard } {
    const text = `**任务操作**\n\n选择要执行的操作：`;
    const keyboard = new InlineKeyboard()
      .text('启用', `cron:confirm:enable:${jobId}`)
      .text('禁用', `cron:confirm:disable:${jobId}`).row()
      .text('立即执行', `cron:confirm:run:${jobId}`).row()
      .text('最近运行', `cron:run:lastrun:${jobId}`).row()
      .text('返回', 'menu:open:service-control').row();
    return { text, keyboard };
  },

  backupList(
    archives: string[]
  ): { text: string; keyboard: InlineKeyboard } {
    let text = `**备份列表**（${archives.length} 个）\n\n`;
    if (archives.length === 0) {
      text += '暂无备份';
    } else {
      for (let i = 0; i < archives.length; i++) {
        text += `${i + 1}. ${archives[i]}\n`;
      }
    }
    const keyboard = new InlineKeyboard();
    for (const archive of archives.slice(0, 10)) {
      const label = archive.length > 25 ? archive.slice(0, 25) + '…' : archive;
      keyboard.text(label, `backup:menu:${encodeURIComponent(archive)}`).row();
    }
    keyboard.text('返回', 'menu:open:service-control').row();
    return { text, keyboard };
  },

  backupItemMenu(
    archive: string
  ): { text: string; keyboard: InlineKeyboard } {
    const encoded = encodeURIComponent(archive);
    const text = `**备份详情**\n\n\`${archive}\``;
    const keyboard = new InlineKeyboard()
      .text('校验', `backup:verify:${encoded}`)
      .text('恢复', `backup:run:restore:${encoded}`).row()
      .text('删除', `backup:delete:${encoded}`).row()
      .text('返回', 'backup:run:list').row();
    return { text, keyboard };
  },

  auditLogs(
    logs: Array<{ created_at: string; action: string; target: string | null; result: string; message: string | null }>,
    showErrors: boolean
  ): { text: string; keyboard: InlineKeyboard } {
    const title = showErrors ? '失败记录' : '最近操作';
    let text = `**${title}**（${logs.length} 条）\n\n`;
    if (logs.length === 0) {
      text += '暂无记录';
    } else {
      const items = logs.slice(0, 15);
      for (const log of items) {
        const icon = log.result === 'success' ? '✅' : '❌';
        const target = log.target ? ` | ${log.target}` : '';
        const msg = log.message ? ` | ${log.message}` : '';
        text += `${icon} ${log.created_at} | ${log.action}${target}${msg}\n`;
      }
      if (logs.length > 15) {
        text += `\n... 共 ${logs.length} 条`;
      }
    }
    const keyboard = new InlineKeyboard()
      .text('最近操作', 'audit:run:recent')
      .text('失败记录', 'audit:run:errors').row()
      .text('返回', 'menu:open:management').row();
    return { text, keyboard };
  },

  settingsConfig(
    output: string
  ): { text: string; keyboard: InlineKeyboard } {
    const configFile = extractKeyValue(output, 'file') || extractKeyValue(output, 'path');
    let text = '**配置摘要**\n\n';
    if (configFile) {
      text += `配置文件: ${configFile}\n`;
    } else {
      text += formatAsList(output);
    }
    const keyboard = new InlineKeyboard()
      .text('配置摘要', 'settings:run:config')
      .text('状态图标', 'settings:run:emoji').row()
      .text('连接状态', 'settings:run:connection')
      .text('告警间隔', 'settings:run:alert_interval').row()
      .text('版本', 'settings:run:version').row()
      .text('返回', 'menu:open:management').row();
    return { text, keyboard };
  },

  connectionStatus(
    profileType: string,
    details: string
  ): { text: string; keyboard: InlineKeyboard } {
    const text = `**连接状态**\n\n连接方式: ${profileType}\n连接详情: ${details}`;
    const keyboard = new InlineKeyboard()
      .text('重新发现', 'connect:rediscover')
      .text('重置连接', 'connect:reset').row()
      .text('返回', 'menu:open:main').row();
    return { text, keyboard };
  },

  aclStatus(
    whitelisted: boolean
  ): { text: string; keyboard: InlineKeyboard } {
    const emoji = whitelisted ? '✅' : '❌';
    const status = whitelisted ? '已授权' : '未授权';
    const text = `**群授权状态**\n\n当前群状态: ${emoji} ${status}`;
    const keyboard = new InlineKeyboard()
      .text('申请授权', 'acl:run:request')
      .text('允许当前群', 'acl:run:allow').row()
      .text('移除当前群', 'acl:run:remove').row()
      .text('白名单', 'acl:run:whitelist')
      .text('待审批', 'acl:run:pending').row()
      .text('返回', 'menu:open:management').row();
    return { text, keyboard };
  },

  whitelist(
    entries: Array<{ chat_id: string; chat_title: string | null }>
  ): { text: string; keyboard: InlineKeyboard } {
    let text = `**白名单**（${entries.length} 个）\n\n`;
    if (entries.length === 0) {
      text += '暂无白名单条目';
    } else {
      for (const entry of entries) {
        const title = entry.chat_title ? entry.chat_title : '私聊';
        text += `• ${title} (\`${entry.chat_id}\`)\n`;
      }
    }
    const keyboard = new InlineKeyboard()
      .text('允许当前群', 'acl:run:allow')
      .text('移除当前群', 'acl:run:remove').row()
      .text('返回', 'menu:open:management').row();
    return { text, keyboard };
  },

  pendingGroups(
    groups: Array<{ chat_id: number; chat_title: string | null }>
  ): { text: string; keyboard: InlineKeyboard } {
    let text = `**待审批群**（${groups.length} 个）\n\n`;
    if (groups.length === 0) {
      text += '暂无待审批群';
    }
    const keyboard = new InlineKeyboard();
    for (const g of groups) {
      const label = g.chat_title ?? String(g.chat_id);
      keyboard.text(`批准 ${label}`, `acl:approve:${g.chat_id}`)
        .text('拒绝', `acl:reject:${g.chat_id}`).row();
    }
    keyboard.text('返回', 'menu:open:acl').row();
    return { text, keyboard };
  },

  genericResult(
    title: string,
    code: number,
    output: string,
    returnMenu: string
  ): { text: string; keyboard: InlineKeyboard } {
    return this.resultWithKeyboard(
      title,
      code,
      output,
      new InlineKeyboard().text('返回', `menu:open:${returnMenu}`).row()
    );
  },

  resultWithKeyboard(
    title: string,
    code: number,
    output: string,
    keyboard: InlineKeyboard
  ): { text: string; keyboard: InlineKeyboard } {
    const emoji = codeEmoji(code);
    const formatted = formatAsList(output);
    const text = `**${title}**\n\n状态: ${emoji} ${code === 0 ? '成功' : '失败'}\n\n${formatted}`;
    return { text, keyboard };
  },

  errorResult(
    message: string
  ): { text: string; keyboard: InlineKeyboard } {
    const text = `**操作失败**\n\n${truncate(message)}`;
    const keyboard = new InlineKeyboard()
      .text('返回', 'menu:open:main').row();
    return { text, keyboard };
  },
};
