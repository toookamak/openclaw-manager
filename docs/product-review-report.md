# OpenClaw Manager 产品评审与修复报告 v1

> 报告编号：REVIEW-20260331-01
> 评审时间：2026-03-31
> 评审维度：流程完整性、用户体验、安全性、可维护性

---

## 一、产品概述

OpenClaw Manager 是一个基于 Telegram Bot + OpenClaw CLI + SQLite 的运维管理工具，通过 Telegram Inline Keyboard 暴露常用运维动作。

### 当前架构
- **入口层**：Telegram Bot（grammy）
- **业务层**：12 个 Service（status/health/model/doctor/cron/backup/log/restart/connectivity/settings/alert/approval/connection）
- **适配层**：OpenClaw CLI 命令封装 + 三种后端（local-cli / docker-cli / http-api）
- **存储层**：SQLite（5 张表：settings / whitelist_chats / pending_groups / audit_logs / state_cache）

---

## 二、已具备的完整流程（✅ 无需修改）

| 流程 | 状态 | 说明 |
|------|------|------|
| 启动流程 | ✅ | DB 初始化 → 连接发现/加载 → Bot 启动 → 告警定时任务 |
| 菜单导航 | ✅ | 三种模式（状态查看/服务控制/管理授权）→ 子菜单 → 操作 → 返回 |
| 连接管理 | ✅ | 自动发现（local/docker/http）→ 手动输入 → 确认 → 持久化到 settings |
| ACL 审批 | ✅ | 群申请 → 管理员通知 → 待审批列表 → 批准/拒绝 → 白名单 |
| 告警监控 | ✅ | 定时检查（connection/gateway/provider）→ 连续 3 次失败告警 → 恢复通知 |
| 危险操作二次确认 | ✅ | 重启、Doctor 修复、模型切换均有 confirm 菜单 |
| 权限控制 | ✅ | 所有写操作均校验 `isAdmin(ctx)` |

---

## 三、发现的问题与修复清单

### P0 — 阻断流程完整性（必须修复）

#### 1. 备份验证功能未接入菜单

**问题描述**：`backup-service.ts` 已实现 `verify(archive)` 方法，`openclawCommands` 也有 `backupVerify`，但 `callbacks.ts` 和 `menus.ts` 中没有任何入口调用。用户创建备份后无法校验完整性。

**涉及文件**：
- `src/bot/callbacks.ts` — 缺少 `backup:verify` 回调
- `src/bot/menus.ts` — `backupMenu()` 缺少验证按钮，缺少备份列表项菜单

**修复要求**：
1. `menus.ts` 中 `backupMenu()` 增加"验证备份"按钮（仅在有备份时显示或引导输入）
2. 新增 `backupListMenu()` 列出备份文件，每个备份有"验证"按钮
3. `callbacks.ts` 增加 `backup:verify:<archive>` 回调，调用 `backupService.verify(archive)`

#### 2. 备份恢复功能缺失

**问题描述**：备份流程只有"创建"和"列表"，缺少"恢复"功能。运维场景下备份的核心价值在于回滚，当前流程只有前半段。

**涉及文件**：
- `src/openclaw/commands.ts` — 缺少 `backupRestore(archive)` 命令
- `src/services/backup-service.ts` — 缺少 `restore(archive)` 方法
- `src/bot/menus.ts` — 备份列表项菜单缺少"恢复"按钮
- `src/bot/callbacks.ts` — 缺少恢复相关回调（含二次确认）

**修复要求**：
1. `commands.ts` 新增 `backupRestore(archive)` → `exec(['backup', 'restore', archive])`
2. `backup-service.ts` 新增 `restore(archive)` 方法
3. `menus.ts` 备份列表项菜单增加"恢复"按钮
4. `callbacks.ts` 增加 `backup:confirm:restore:<archive>` → 二次确认 → `backup:run:restore:<archive>`
5. 恢复操作需要 `isAdmin` 校验 + 审计日志

#### 3. 审计日志查看功能未暴露

**问题描述**：`log-service.ts` 已实现 `auditLogs(limit)` 方法，`auditLogRepo` 也有 `recent()` 和 `errors()` 查询，但整个菜单系统和回调系统中没有任何入口。审计功能形同虚设。

**涉及文件**：
- `src/bot/menus.ts` — ACL 菜单或管理授权菜单中缺少"审计日志"入口
- `src/bot/callbacks.ts` — 缺少 `audit:run:recent` 和 `audit:run:errors` 回调

**修复要求**：
1. `menus.ts` 中 `managementMenu()` 或 `aclMenu()` 增加"审计日志"按钮
2. 新增 `auditMenu()` 子菜单：最近操作 / 失败记录
3. `callbacks.ts` 增加对应回调，调用 `logService.auditLogs()`

#### 4. 审计日志只记录成功，不记录真实结果

**问题描述**：`callbacks.ts` 中所有 `auditLogRepo.log()` 调用的 `result` 参数均硬编码为 `'success'`，无论底层 CLI 实际返回码是什么。这导致无法区分操作成功/失败，审计日志失去追溯价值。

**涉及文件**：
- `src/bot/callbacks.ts` — 所有 `auditLogRepo.log()` 调用

**当前代码示例**（错误）：
```typescript
auditLogRepo.log(BigInt(ctx.from?.id ?? 0), BigInt(ctx.chat?.id ?? 0), 'model:set', model, 'success', null);
```

**修复要求**：
1. 每个写操作回调中，根据 CLI 返回的 `code` 判断结果：
   ```typescript
   const result = res.code === 0 ? 'success' : 'failed';
   auditLogRepo.log(..., result, res.stderr || null);
   ```
2. 涉及的操作包括：`model:set`、`doctor:repair`、`cron:enable/disable/run`、`acl:approve/reject`、`restart:openclaw/gateway`、`backup:create/restore`
3. 失败时将 CLI 的 stderr 或 error message 写入 `message` 字段

---

### P1 — 影响核心体验（建议修复）

#### 5. Settings 功能薄弱

**问题描述**：系统设置目前只有"配置摘要"（查看 openclaw 配置文件路径）和"状态图标开关"两个功能。作为管理授权模块的一部分，缺少关键配置查看/修改能力。

**涉及文件**：
- `src/bot/menus.ts` — `settingsMenu()` 仅两个按钮
- `src/bot/callbacks.ts` — `settings:run` 只处理 `config` 和 `emoji`
- `src/services/settings-service.ts` — 缺少更多设置管理能力

**修复要求**：
1. 增加"告警间隔"查看和修改（当前仅环境变量配置）
2. 增加"连接状态"查看（当前连接类型、后端信息）
3. 增加"查看 OpenClaw 版本"入口

#### 6. 不支持多管理员

**问题描述**：`env.ts` 中 `ADMIN_TELEGRAM_ID` 是单个 BigInt，`isAdmin()` 只比较一个 ID。团队协作场景下无法配置多个管理员。

**涉及文件**：
- `src/config/env.ts` — `adminTelegramId` 为单个值
- `src/bot/callbacks.ts` — `isAdmin()` 只比较一个 ID
- `src/bot/commands.ts` — `/menu` 权限校验只比较一个 ID

**修复要求**：
1. 环境变量改为 `ADMIN_TELEGRAM_IDS`，支持逗号分隔多个 ID
2. `config.adminTelegramIds` 改为 `Set<bigint>` 或 `bigint[]`
3. `isAdmin()` 改为检查是否在集合中
4. 保持向后兼容：如果只填 `ADMIN_TELEGRAM_ID`（单数）也能正常工作

#### 7. 备份列表无交互菜单

**问题描述**：`backup:run:list` 直接输出文本列表，用户无法对单个备份执行操作（验证/恢复/删除）。

**涉及文件**：
- `src/bot/callbacks.ts` — `backup:run:list` 直接 reply 文本
- `src/bot/menus.ts` — 缺少备份项级别菜单

**修复要求**：
1. 解析 `backup list` 输出或新增 `backupList` 命令返回结构化数据
2. `backup:run:list` 改为显示带按钮的列表，每个备份有操作按钮
3. 或新增 `backup:menu:<index>` 进入单个备份的操作菜单

---

### P2 — 锦上添花（可选优化）

#### 8. 告警间隔不可动态调整

**问题描述**：`ALERT_CHECK_INTERVAL_SEC` 仅在启动时从环境变量读取，`setInterval` 使用固定值。运行时无法调整监控频率。

**修复要求**：将 `setInterval` 改为可动态读取配置的模式，或在 Settings 中暴露调整入口。

#### 9. 用户无法主动取消 pendingAction

**问题描述**：连接设置中的 `pendingAction` 有 5 分钟过期，但用户发送非预期文本时只是静默忽略，没有提示如何取消。

**修复要求**：在 pending 状态下，用户发送 `/cancel` 时清除 pendingAction 并提示。

#### 10. 缺少备份删除功能

**问题描述**：`openclaw` CLI 可能有 `backup delete` 命令，但项目中未暴露。

**修复要求**：确认 CLI 是否支持，如支持则补全入口。

---

## 四、修复优先级总结

| 优先级 | 编号 | 问题 | 预计工作量 |
|--------|------|------|------------|
| P0 | #1 | 备份验证接入菜单 | 小 |
| P0 | #2 | 备份恢复功能 | 中 |
| P0 | #3 | 审计日志查看入口 | 小 |
| P0 | #4 | 审计日志记录真实结果 | 中 |
| P1 | #5 | Settings 功能增强 | 中 |
| P1 | #6 | 多管理员支持 | 小 |
| P1 | #7 | 备份列表交互菜单 | 中 |
| P2 | #8 | 告警间隔动态调整 | 小 |
| P2 | #9 | pendingAction 取消机制 | 小 |
| P2 | #10 | 备份删除功能 | 小 |

---

## 五、完整度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 核心运维流程 | 8/10 | 状态查看、诊断、重启、模型切换等主流程完整 |
| 备份恢复流程 | 4/10 | 只有创建和列表，缺少验证入口和恢复功能 |
| 安全审计流程 | 5/10 | ACL 审批完整，但审计日志不可查看、不记录失败 |
| 用户体验 | 6/10 | 有二次确认和菜单导航，但缺少帮助提示和主动取消 |
| 可扩展性 | 7/10 | 后端抽象良好，但单管理员限制 |
| **综合评分** | **6/10** | **核心功能可用，但备份和审计流程断裂** |

---

## 六、建议修复顺序

```
第一批（P0）：
  1. #4 审计日志记录真实结果（改动最小，影响最大）
  2. #3 审计日志查看入口（配合 #4 才有意义）
  3. #1 备份验证接入菜单
  4. #2 备份恢复功能

第二批（P1）：
  5. #6 多管理员支持（改动小，实用性强）
  6. #7 备份列表交互菜单（配合第一批的备份功能）
  7. #5 Settings 功能增强

第三批（P2）：
  8. #9 pendingAction 取消机制
  9. #8 告警间隔动态调整
  10. #10 备份删除功能
```
