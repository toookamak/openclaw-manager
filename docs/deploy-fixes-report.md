# OpenClaw Manager 部署前修复与风险报告 v1

> 报告编号：DEPLOY-20260331-01
> 评审时间：2026-03-31
> 目的：部署前最后检查，确保生产环境稳定运行

---

## 一、必须修复（阻塞部署）

### 1. 告警通知只发给第一个管理员

**文件**：`src/services/alert-service.ts`
**行号**：第 29 行、第 38 行
**问题**：多管理员已支持（`config.adminTelegramIds`），但告警发送仍使用旧的 `config.adminTelegramId`（单数），导致只有第一个管理员能收到告警和恢复通知。

**当前代码**：
```typescript
// sendAlert (line 29)
await botInstance.api.sendMessage(Number(config.adminTelegramId), `**告警**\n\n${message}`, { parse_mode: 'Markdown' });

// sendRecovery (line 38)
await botInstance.api.sendMessage(Number(config.adminTelegramId), `**恢复**\n\n${message}`, { parse_mode: 'Markdown' });
```

**修复要求**：
```typescript
async function sendAlert(message: string): Promise<void> {
  if (!botInstance) return;
  for (const adminId of config.adminTelegramIds) {
    try {
      await botInstance.api.sendMessage(Number(adminId), `**告警**\n\n${message}`, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error({ err, adminId }, 'Failed to send alert');
    }
  }
}

async function sendRecovery(message: string): Promise<void> {
  if (!botInstance) return;
  for (const adminId of config.adminTelegramIds) {
    try {
      await botInstance.api.sendMessage(Number(adminId), `**恢复**\n\n${message}`, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error({ err, adminId }, 'Failed to send recovery');
    }
  }
}
```

---

### 2. `.env.example` 未更新多管理员配置

**文件**：`.env.example`
**问题**：新增了 `ADMIN_TELEGRAM_IDS` 环境变量，但示例文件未更新，部署者不知道如何配置多管理员。

**当前内容**：
```env
# Required
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_TELEGRAM_ID=your_telegram_user_id_here
```

**修复要求**：
```env
# Required (choose one)
# Option A: Single admin (legacy, still supported)
ADMIN_TELEGRAM_ID=your_telegram_user_id_here

# Option B: Multiple admins (comma-separated, recommended)
# ADMIN_TELEGRAM_IDS=123456789,987654321
```

---

## 二、设计缺陷（建议修复）

### 3. 告警间隔动态设置实际不生效

**文件**：`src/index.ts` 第 63 行、`src/services/settings-service.ts`
**问题**：`settingsService.setAlertInterval(seconds)` 将值写入 SQLite，但 `index.ts` 中的 `setInterval` 在启动时已用 `config.alertCheckIntervalSec` 创建固定定时器。运行时修改 DB 值不会改变已运行的定时器。

**当前代码**（index.ts:63）：
```typescript
setInterval(() => {
  runAlertCheck().catch(err => logger.error({ err }, 'Alert check failed'));
}, config.alertCheckIntervalSec * 1000);
```

**修复方案（二选一）**：

方案 A — 每次检查时动态读取间隔（推荐，简单可靠）：
```typescript
function scheduleNextCheck(): void {
  const interval = settingsService.getAlertInterval() * 1000;
  setTimeout(() => {
    runAlertCheck()
      .catch(err => logger.error({ err }, 'Alert check failed'))
      .finally(() => scheduleNextCheck());
  }, interval);
}

// 替换原来的 setInterval
scheduleNextCheck();
```

方案 B — 修改间隔时清除旧定时器并重建：
```typescript
let alertTimer: ReturnType<typeof setInterval>;

function startAlertTimer(): void {
  if (alertTimer) clearInterval(alertTimer);
  alertTimer = setInterval(() => {
    runAlertCheck().catch(err => logger.error({ err }, 'Alert check failed'));
  }, settingsService.getAlertInterval() * 1000);
}

// setAlertInterval() 中调用 startAlertTimer()
```

---

## 三、生产风险项（建议优化）

### 4. 无 Docker healthcheck

**文件**：`docker-compose.yml`、`Dockerfile`
**风险**：编排平台无法感知 Bot 是否真正可用（进程运行 ≠ Bot 能响应消息）。容器崩溃或 Telegram 长轮询断开时不会被自动重建。

**建议**：
```yaml
# docker-compose.yml 中添加
healthcheck:
  test: ["CMD", "node", "-e", "process.exit(0)"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

> 注意：当前没有 HTTP 端口暴露，healthcheck 只能检查进程存活。如需更精确的健康检查，可考虑让 Bot 启动时写一个 heartbeat 文件。

---

### 5. 审计日志 acl:approve/reject 缺少异常捕获

**文件**：`src/bot/callbacks.ts` 第 465-481 行
**风险**：`acl:approve` 和 `acl:reject` 的审计日志始终记录 `'success'`，如果 DB 写入失败（如磁盘满、锁冲突），操作实际失败但审计记录显示成功。

**当前代码**：
```typescript
bot.callbackQuery(/^acl:approve:(-?\d+)$/, async (ctx: BotContext) => {
  await ack(ctx);
  if (!isAdmin(ctx)) return;
  const chatId = BigInt(ctx.match![1]);
  approvalService.approveGroup(chatId);
  auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'success', null);
  await reply(ctx, '已批准授权。', menus.aclMenu());
});
```

**修复要求**：
```typescript
bot.callbackQuery(/^acl:approve:(-?\d+)$/, async (ctx: BotContext) => {
  await ack(ctx);
  if (!isAdmin(ctx)) return;
  const chatId = BigInt(ctx.match![1]);
  try {
    approvalService.approveGroup(chatId);
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'success', null);
    await reply(ctx, '已批准授权。', menus.aclMenu());
  } catch (err) {
    auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'acl:approve', String(chatId), 'failed', String(err));
    await reply(ctx, '批准授权失败，请重试。', menus.aclMenu());
  }
});
```

`acl:reject` 同理修复。

---

### 6. 无日志轮转

**风险**：pino 日志输出到 stdout，Docker 环境下依赖 Docker 日志驱动。长期运行可能导致宿主机磁盘占满。

**建议**：在 `docker-compose.yml` 中配置日志驱动和大小限制：
```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 四、修复优先级总结

| 优先级 | 编号 | 问题 | 类型 | 工作量 |
|--------|------|------|------|--------|
| P0 | #1 | 告警通知只发第一个管理员 | Bug | 小 |
| P0 | #2 | .env.example 未更新 | 文档 | 极小 |
| P1 | #3 | 告警间隔动态设置不生效 | 设计缺陷 | 小 |
| P2 | #4 | 无 Docker healthcheck | 运维 | 小 |
| P2 | #5 | acl 审计日志缺异常捕获 | 可靠性 | 小 |
| P2 | #6 | 无日志轮转 | 运维 | 极小 |

---

## 五、建议修复顺序

```
第一步（P0，阻塞部署）：
  #1 alert-service.ts 多管理员告警适配
  #2 .env.example 更新

第二步（P1，建议同步修复）：
  #3 告警间隔动态生效

第三步（P2，部署后优化）：
  #4 Docker healthcheck
  #5 acl 审计日志 try-catch
  #6 日志轮转配置
```

---

## 六、部署检查清单

修复 P0 后可执行：

```
[ ] 创建 .env 文件，填写 BOT_TOKEN 和 ADMIN_TELEGRAM_IDS
[ ] docker compose up -d --build
[ ] 验证 Bot 响应 /ping
[ ] 验证 /menu 菜单正常显示
[ ] 验证连接自动发现或手动配置连接
[ ] 验证一次状态查询操作（如 状态概览）
[ ] 验证告警通知是否送达所有管理员
[ ] 验证备份创建和列表功能
[ ] 验证审计日志查看功能
```
