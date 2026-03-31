# OpenClaw Manager 交互优化需求报告 v3

> 报告编号：REQ-20260331-03
> 评审时间：2026-03-31
> 来源：交互体验评审 + 模板未接入问题

---

## 一、核心问题：模板未接入服务层

### 1.1 问题描述

`templates.ts` 已创建 17 个结构化模板，但 **所有 services 仍使用旧的 `formatOutput()`**，返回结果仍是代码块包裹的原始 CLI 输出。

### 1.2 当前调用链（错误）

```
callbacks.ts → statusService.overview() → formatOutput(res.raw) → ```代码块```
```

### 1.3 目标调用链

```
callbacks.ts → statusService.overview() → templates.statusOverview() → 结构化 Markdown + InlineKeyboard
```

### 1.4 需要改造的 Service 列表

| Service | 当前方法 | 需改用模板 | 优先级 |
|---------|----------|------------|--------|
| status-service | `overview()` / `full()` / `deep()` | `templates.statusOverview()` | P0 |
| health-service | `gatewayHealth()` / `fullHealth()` / `recentErrors()` | `templates.gatewayHealth()` / `fullHealth()` / `recentErrors()` | P0 |
| model-service | `current()` / `available()` / `setModel()` | `templates.modelInfo()` / `modelList()` | P0 |
| cron-service | `status()` / `list()` / `enable()` / `disable()` / `run()` / `lastRun()` | `templates.cronStatus()` / `cronList()` / `cronJobMenu()` / `genericResult()` | P0 |
| backup-service | `create()` / `list()` | `templates.backupList()` / `genericResult()` | P0 |
| doctor-service | `diagnose()` / `repair()` | `templates.genericResult()` | P1 |
| log-service | `recentLogs()` / `errorSummary()` | 保留代码块 + 标题格式 | P1 |
| connectivity-service | `channelsProbe()` / `providerProbe()` / `usage()` | `templates.connectivityResult()` | P1 |
| settings-service | `configSummary()` / `connectionStatus()` / `openclawVersion()` | `templates.settingsConfig()` / `connectionStatus()` | P1 |
| approval-service | `whitelist()` / `pendingGroups()` / `aclStatus()` | `templates.whitelist()` / `pendingGroups()` / `aclStatus()` | P1 |

### 1.5 改造方式

每个 Service 方法返回 `{ text: string; keyboard: InlineKeyboard }` 而非纯字符串，callbacks 中拆分 text 和 keyboard 分别传给 `reply()`。

---

## 二、关于页面

### 2.1 功能描述

新增 `/about` 命令和菜单入口，展示 OpenClaw 系统信息和 Bot 自身状态。

### 2.2 触发方式

- 命令：`/about`
- 菜单：管理授权 → 关于（或独立一级入口）

### 2.3 展示内容

```markdown
**关于 OpenClaw Manager**

Bot 版本: v1.0.0
OpenClaw 版本: v1.2.3
运行状态: ✅ 运行中
PID: 12345
运行时长: 3d 14h 22m

连接方式: 本机 CLI
连接状态: ✅ 已连接

[刷新]
```

### 2.4 实现要点

1. 新增 `src/bot/about-handler.ts` 或在 callbacks 中处理
2. 读取 `package.json` version 作为 Bot 版本
3. 调用 `openclawCommands.status()` 获取 OpenClaw 版本/PID/运行时长
4. 读取 `connectionService.getProfile()` 获取连接方式
5. 底部附 `[刷新]` 按钮

---

## 三、交互优化

### 3.1 点击处理中反馈

**问题**：点击按钮后直到 CLI 返回前界面无任何反馈，用户可能重复点击。

**修复**：所有回调函数中，先调用 `answerCallbackQuery({ text: '处理中...' })` 再执行操作。

```typescript
bot.callbackQuery(/^status:run:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: '处理中...' });
  // ... 执行操作
});
```

### 3.2 错误信息模板化

**问题**：CLI 的 stderr 直接展示给用户，如 `Error: model "gpt-5" not found`。

**修复**：增加错误码映射，输出用户友好的中文提示。

```typescript
function friendlyError(code: number, stderr: string): string {
  if (stderr.includes('not found')) return '未找到指定资源，请检查名称是否正确。';
  if (stderr.includes('permission')) return '权限不足，请检查 OpenClaw 配置。';
  if (stderr.includes('timeout')) return '操作超时，请稍后重试。';
  return `操作失败：${stderr.slice(0, 200)}`;
}
```

### 3.3 结果页刷新按钮

**问题**：查看状态后想再次检查，需要重新进入菜单点击。

**修复**：所有只读查询结果底部增加 `[刷新]` 按钮，点击重新执行同一操作。

```typescript
// 示例：状态概览结果页
const keyboard = new InlineKeyboard()
  .text('完整状态', 'status:run:full')
  .text('深度状态', 'status:run:deep').row()
  .text('刷新', 'status:run:overview')  // 新增
  .text('返回', 'menu:open:status-view').row();
```

### 3.4 超长内容分页

**问题**：输出超过 3500 字符被硬截断，用户无法查看完整内容。

**修复**：截断时增加 `[查看更多]` 按钮，点击发送后续内容。

```typescript
function paginate(text: string, page = 1): { text: string; hasMore: boolean } {
  const PAGE_SIZE = 3500;
  const start = (page - 1) * PAGE_SIZE;
  const chunk = text.slice(start, start + PAGE_SIZE);
  const hasMore = start + PAGE_SIZE < text.length;
  return { text: chunk, hasMore };
}
```

### 3.5 危险操作确认超时

**问题**：确认按钮一直有效，可能误触。

**修复**：确认菜单 30 秒后自动失效（通过 `pendingAction` 过期机制，已在 callbacks 中实现 5 分钟过期，缩短为 30 秒仅针对危险操作）。

### 3.6 操作撤回（可选）

**问题**：备份恢复/模型切换后无法快速回退。

**修复**：执行后 60 秒内提供 `[撤回]` 按钮，记录操作前状态并支持回滚。

---

## 四、实现优先级

| 优先级 | 模块 | 工作量 | 说明 |
|--------|------|--------|------|
| P0 | 模板接入服务层 | 大 | 10 个 service 改造，核心体验问题 |
| P0 | 点击处理中反馈 | 小 | 全局 ack 改为带 text 的 answerCallbackQuery |
| P0 | 错误信息模板化 | 中 | 新增错误映射函数，替换直接暴露 stderr |
| P1 | 关于页面 | 小 | 独立入口，展示版本和状态 |
| P1 | 结果页刷新按钮 | 小 | 所有只读模板增加刷新按钮 |
| P2 | 超长内容分页 | 中 | 分页逻辑 + 状态管理 |
| P2 | 危险操作确认超时 | 小 | 缩短 pendingAction 过期时间 |
| P2 | 操作撤回 | 中 | 状态快照 + 回滚逻辑 |

---

## 五、验收标准

### 模板接入
- [ ] 所有 service 返回 `{ text, keyboard }` 而非纯字符串
- [ ] 状态/健康/模型类信息使用结构化 Markdown 展示
- [ ] 无原始 CLI 输出直接暴露给用户
- [ ] 所有结果页附带对应操作按钮

### 关于页面
- [ ] `/about` 命令可用
- [ ] 展示 Bot 版本、OpenClaw 版本、PID、运行时长、连接方式
- [ ] 支持刷新

### 交互优化
- [ ] 点击按钮后显示"处理中..."
- [ ] 错误信息为用户友好的中文提示
- [ ] 只读查询结果页有刷新按钮
- [ ] 超长内容有分页或截断提示
