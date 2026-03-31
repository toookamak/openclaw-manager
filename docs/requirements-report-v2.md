# OpenClaw Manager 需求报告 v2

> 报告编号：REQ-20260331-02
> 评审时间：2026-03-31
> 来源：产品评审 Roadmap 待办事项

---

## 一、菜单扁平化

### 1.1 设计原则

- 常规操作最多 2 步：命令 → 按钮 → 结果
- 危险操作最多 3 步：命令 → 按钮 → 二次确认 → 结果（确认属于安全拦截，不计入业务层级）
- 列表选择最多 3 步：命令 → 按钮 → 列表 → 操作
- 按三种模式拆分为三个独立命令，替代原有 `/menu` 多级嵌套

### 1.2 命令定义

#### `/status` — 状态查看（只读）

| 按钮 | 回调 | 行为 | 返回后按钮 |
|------|------|------|------------|
| 状态概览 | `status:run:overview` | 调用 `openclaw status` | 面板常驻 |
| 完整状态 | `status:run:full` | 调用 `openclaw status --all` | 面板常驻 |
| 深度状态 | `status:run:deep` | 调用 `openclaw status --deep` | 面板常驻 |
| Gateway健康 | `health:run:gateway` | 调用 `openclaw gateway health` | 面板常驻 |
| 全量健康 | `health:run:full` | 调用 `openclaw health --json` | 面板常驻 |
| 最近异常 | `health:run:errors` | 过滤 logs 中 error/fatal | 面板常驻 |
| 通道连通性 | `conn:run:channels` | 调用 `openclaw channels status --probe` | 面板常驻 |
| Provider | `conn:run:provider` | 调用 `openclaw models status --probe` | 面板常驻 |
| Usage | `conn:run:usage` | 调用 `openclaw status --usage` | 面板常驻 |
| 最近日志 | `logs:run:recent` | 调用 `openclaw logs --limit 200` | 面板常驻 |
| 错误摘要 | `logs:run:errors` | 过滤 error/warn/fatal | 面板常驻 |

**交互特点**：所有按钮点击后直接返回结果，原消息区域更新内容，按钮面板保持常驻可反复点击。无需二次确认。

---

#### `/service` — 服务控制（写操作）

| 按钮 | 回调 | 行为 | 二次确认 |
|------|------|------|----------|
| 当前模型 | `model:run:current` | 调用 `openclaw models status` | 否 |
| 可用模型 | `model:run:list` | 调用 `openclaw models list` | 否 |
| 切换模型 | `model:run:set` | 弹出模型列表（2级） | 是（选择后确认） |
| 诊断 | `doctor:run:diagnose` | 调用 `openclaw doctor` | 否 |
| 修复 | `doctor:run:repair_confirm` | 弹出确认面板 | 是 |
| 任务状态 | `cron:run:status` | 调用 `openclaw cron status` | 否 |
| 任务列表 | `cron:run:list` | 弹出任务列表（2级） | 启用/禁用/执行需确认 |
| 创建备份 | `backup:run:create` | 调用 `openclaw backup create --verify` | 否 |
| 备份列表 | `backup:run:list` | 弹出备份列表（2级） | 恢复/删除需确认 |
| 重启OpenClaw | `restart:confirm:openclaw` | 弹出确认面板 | 是 |
| 重启Gateway | `restart:confirm:gateway` | 弹出确认面板 | 是 |

**交互特点**：
- 只读操作（当前模型/可用模型/诊断/任务状态/创建备份）点击直接返回
- 写操作均需 `isAdmin` 校验
- 危险操作（修复/重启/模型切换/备份恢复/备份删除/任务启停）必须二次确认
- 列表类操作（任务列表/备份列表）进入 2 级子面板，选择后执行操作

---

#### `/admin` — 管理授权（配置/ACL/审计）

| 按钮 | 回调 | 行为 | 二次确认 |
|------|------|------|----------|
| 配置摘要 | `settings:run:config` | 调用 `openclaw config file` | 否 |
| 连接状态 | `settings:run:connection` | 读取当前连接配置 | 否 |
| OpenClaw版本 | `settings:run:version` | 调用 `openclaw status` 解析版本 | 否 |
| 状态图标开关 | `settings:run:emoji` | 切换 emoji 显示 | 否 |
| 告警间隔 | `settings:run:alert_interval` | 显示当前值，等待文本输入 | 否（输入范围校验 10-3600） |
| 群授权状态 | `acl:run:status` | 检查当前群是否在白名单 | 否 |
| 申请授权 | `acl:run:request` | 提交当前群授权申请 | 否 |
| 待审批 | `acl:run:pending` | 弹出待审批列表（2级） | 批准/拒绝需确认 |
| 白名单 | `acl:run:whitelist` | 列出所有已授权群 | 否 |
| 允许当前群 | `acl:run:allow` | 将当前群加入白名单 | 是（管理员操作需确认） |
| 移除当前群 | `acl:run:remove` | 将当前群移出白名单 | 是 |
| 审计日志 | `audit:run:recent` | 弹出审计子菜单 | 否 |

**审计子菜单**（2级）：
```
[最近操作] [失败记录] [返回]
```

**交互特点**：
- 配置查看类直接返回
- 告警间隔通过文本输入设置，带范围校验
- ACL 审批操作需 `isAdmin` 校验
- 待审批列表进入 2 级子面板，逐项批准/拒绝

---

### 1.3 全局命令保留

| 命令 | 用途 |
|------|------|
| `/start` | 帮助信息 + 三个命令引导 |
| `/menu` | 保留作为全局导航入口（兼容旧用户习惯） |
| `/id` | 查看当前 chat_id / user_id |
| `/ping` | Bot 在线检查 |
| `/cancel` | 取消待处理操作 |
| `/connect` | 连接管理（重新发现/手动配置/重置） |

### 1.4 `/start` 更新内容

```
**OpenClaw 管理工具**

快捷命令：
/status — 状态查看（只读）
/service — 服务控制（写操作）
/admin — 管理授权（配置/ACL）

辅助命令：
/id — 查看当前 ID
/ping — 检查 Bot 在线
/cancel — 取消当前操作
/connect — 连接管理
```

---

## 二、回复模板美化

### 2.1 问题描述

当前所有操作结果均以原始代码块形式返回（```` ```...\n...\n``` ````），缺乏结构化和可读性。长文本超出 3500 字符被硬截断，关键信息不突出。

### 2.2 模板设计原则

- 关键指标使用 Markdown 粗体/列表展示，避免全包在代码块中
- 状态类信息使用结构化摘要（键值对列表）
- 日志/错误类信息保留代码块，但增加时间戳和级别标签
- 列表类信息使用 Telegram 原生列表格式
- 超长内容提供"查看更多"分页按钮

### 2.3 模板规范

#### 状态类模板

```markdown
**状态概览**

运行状态: ✅ 运行中
版本: v1.2.3
运行时长: 3d 14h 22m
PID: 12345

[完整状态] [深度状态] [刷新]
```

#### 健康类模板

```markdown
**Gateway 健康**

状态: ✅ 正常
响应时间: 45ms

[全量健康] [最近异常] [返回]
```

#### 模型类模板

```markdown
**当前模型**

模型: gpt-4o
Provider: openai
状态: ✅ 可用

[可用模型] [切换模型] [返回]
```

#### 备份列表模板

```markdown
**备份列表**

1. backup-20260331-120000.tar.gz (12.5 MB) ✅ 已校验
2. backup-20260330-060000.tar.gz (12.3 MB) ❌ 未校验

选择备份进行操作：

[backup-20260331-120000] [backup-20260330-060000]
[返回]
```

#### 审计日志模板

```markdown
**最近操作**

✅ 2026-03-31 14:30 | backup:create | -
✅ 2026-03-31 14:25 | model:set | gpt-4o
❌ 2026-03-31 14:20 | cron:enable | job-01 | 任务不存在

[失败记录] [返回]
```

#### 日志/错误模板（保留代码块）

```markdown
**错误摘要**（最近 20 条）

```
2026-03-31 14:20:01 ERROR Connection timeout
2026-03-31 14:19:58 WARN  Retry attempt 3/5
```

[最近日志] [返回]
```

### 2.4 实现要点

1. 新增 `src/bot/templates.ts` 模块，集中管理所有消息模板
2. 每个模板函数接收结构化数据，返回格式化后的 Markdown 字符串 + 对应的 InlineKeyboard
3. 保留 `formatOutput()` 作为兜底方案，当无法解析结构化数据时回退到代码块
4. 模板函数命名规范：`renderStatusOverview()`, `renderHealthResult()`, `renderModelInfo()` 等
5. 所有模板输出长度控制在 4096 字符以内（Telegram 消息上限）

---

## 三、重启通知

### 3.1 功能描述

当检测到 OpenClaw 从不可用状态恢复正常时，自动向所有管理员推送重启通知消息。

### 3.2 触发条件

- `alert-service.ts` 中 `state.connection.alerted` 为 `true` 且本次检查 `status.running` 为 `true`（即从告警状态恢复）

### 3.3 通知内容

```markdown
**OpenClaw 已重启恢复**

启动时间: 2026-03-31 14:30:05
PID: 12345
使用模型: gpt-4o (openai)
版本: v1.2.3
运行时长: 0d 0h 0m 5s

恢复时间: 2026-03-31 14:30:10
故障持续: 约 3 分钟
```

### 3.4 实现要点

1. 恢复时调用 `openclawCommands.status()` 获取版本、PID、运行时长
2. 调用 `openclawCommands.modelsStatus(false)` 获取当前模型
3. 复用 `alert-service.ts` 中已有的多管理员发送逻辑
4. 通知发送给 `config.adminTelegramIds` 中的所有管理员

---

## 四、连接状态通知

### 4.1 功能描述

Bot 启动并与 OpenClaw 成功建立连接后，主动向所有管理员发送连接状态通知。

### 4.2 触发条件

- `index.ts` 中 `connectionService.init()` 加载到已保存连接
- 或 `connectionService.autoDiscoverAndConnect()` 自动发现成功
- 或用户通过 `/connect` 手动配置连接成功

### 4.3 通知内容

```markdown
**OpenClaw 连接已建立**

连接方式: 本机 CLI
命令路径: /usr/local/bin/openclaw
运行状态: ✅ 运行中
版本: v1.2.3
PID: 12345
当前模型: gpt-4o (openai)

使用 /status 查看状态，/service 执行操作
```

### 4.4 实现要点

1. 新增 `src/services/notification-service.ts` 模块，封装状态通知逻辑
2. `index.ts` 启动流程中，连接成功后调用 `sendConnectionStatus(bot)`
3. 连接失败时发送降级通知（仅提示未连接，引导用户使用 `/connect`）
4. 通知发送给 `config.adminTelegramIds` 中的所有管理员

---

## 五、实现优先级

| 优先级 | 模块 | 工作量 | 依赖 |
|--------|------|--------|------|
| P0 | 菜单扁平化 | 大 | 无 |
| P0 | 回复模板美化 | 中 | 无 |
| P1 | 连接状态通知 | 小 | 需 parser 支持 PID 解析 |
| P1 | 重启通知 | 小 | 依赖连接状态通知的通知基础设施 |

---

## 六、验收标准

### 菜单扁平化
- [ ] `/status`、`/service`、`/admin` 三个命令可用
- [ ] 所有只读操作 2 步内完成（命令 → 按钮 → 结果）
- [ ] 所有危险操作有二次确认拦截
- [ ] 原 `/menu` 入口保留但标记为可选

### 回复模板美化
- [ ] 状态/健康/模型类信息使用结构化 Markdown 展示
- [ ] 日志/错误类信息保留代码块但增加格式优化
- [ ] 列表类信息使用 Telegram 原生列表格式
- [ ] 无原始 CLI 输出直接暴露给用户

### 重启通知
- [ ] OpenClaw 恢复后自动推送通知给所有管理员
- [ ] 通知包含启动时间、PID、使用模型、版本

### 连接状态通知
- [ ] Bot 启动连接成功后推送通知给所有管理员
- [ ] 通知包含连接方式、运行状态、当前模型
- [ ] 连接失败时发送降级引导消息
