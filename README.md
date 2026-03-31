# OpenClaw Manager

`OpenClaw Manager` 是一个基于 `Telegram Bot + OpenClaw CLI + SQLite` 的运维管理工具。它通过 Telegram Inline Keyboard 暴露常用运维动作，所有实际操作都通过本机 `openclaw` CLI 执行。

项目当前定位是轻量级 CLI 控制入口，支持三种连接后端：本机 CLI、Docker 容器、HTTP API。

## 菜单模式

顶层菜单分为 3 种使用模式，每种模式有独立的快捷命令：

- `/status` — `状态查看`
  - 面向日常巡检和只读检查
  - 包含：状态、健康检查、连通性、日志
- `/service` — `服务控制`
  - 面向会修改系统状态的运维动作
  - 包含：模型管理、Doctor、定时任务、备份（创建/列表/校验/恢复/删除）、重启
- `/admin` — `管理授权`
  - 面向配置、ACL 和授权管理
  - 包含：系统设置、访问控制、审计日志

`/menu` 保留作为全局导航入口，展示快捷命令引导。
`/connect` 独立管理连接配置（重新发现/手动配置/重置）。

## 功能概览

### Telegram 入口

- `/start`：显示帮助信息
- `/menu`：打开菜单模式选择
- `/id`：查看当前 `chat_id` 和 `user_id`
- `/ping`：检查 Bot 在线状态
- `/cancel`：取消当前待处理操作

### 状态与诊断

- 状态概览：`openclaw status`
- 完整状态：`openclaw status --all`
- 深度状态：`openclaw status --deep`
- Gateway 健康：`openclaw gateway health`
- 全量健康：`openclaw health --json`
- 最近异常：从 `openclaw logs --json` 过滤 `error` / `fatal`
- Doctor 诊断：`openclaw doctor`
- Doctor 修复：自动探测并调用 `--repair` / `--fix` / `-r`

### 模型与连通性

- 当前模型：`openclaw models status`
- 可用模型列表：`openclaw models list`
- 默认模型切换：`openclaw models set <model>`
- 通道探测：`openclaw channels status --probe`
- Provider 探测：`openclaw models status --probe`
- Usage 状态：`openclaw status --usage`

### Cron / 日志 / 备份 / 重启

- 定时任务状态：`openclaw cron status`
- 定时任务列表：`openclaw cron list`
- 定时任务启用、禁用、手动执行、最近运行记录
- 最近日志：`openclaw logs --limit N`
- 错误摘要：过滤 `error` / `warn` / `fatal`
- 备份创建：`openclaw backup create --verify`
- 备份列表：交互式列表，可选择单个备份进行操作
- 备份校验：`openclaw backup verify <archive>`
- 备份恢复：`openclaw backup restore <archive>`（需二次确认）
- 备份删除：`openclaw backup delete <archive>`
- 重启 OpenClaw：`openclaw restart`
- 重启 Gateway：`openclaw gateway restart`

### ACL 与审批

- 查询当前群/用户 ID
- 查询当前群授权状态
- 当前群提交授权申请
- 管理员审批待授权群
- 白名单增删
- 审计日志：最近操作记录 / 失败记录

### 系统设置

- 配置摘要：查看 OpenClaw 配置文件路径
- 状态图标开关：控制状态显示中的 Emoji/标签
- 连接状态：查看当前连接类型和配置
- 告警间隔：动态调整监控检查频率（10-3600 秒）
- OpenClaw 版本：查看当前安装的版本

### 连接管理

- 自动发现：按优先级探测本机 CLI → Docker 容器 → HTTP 端点
- 手动配置：支持输入自定义 CLI 路径或 HTTP 地址
- 连接重置 / 重新发现

### 告警监控

- 定时检查 OpenClaw 状态、Gateway 健康、Provider 连通性
- 连续 3 次失败后发送告警通知
- 恢复正常后发送恢复通知
- 告警通知发送给所有已配置的管理员

### 本地持久化

SQLite 数据库位于 `DATA_DIR/openclaw-manager.db`，当前表包括：

- `settings` — 运行时配置（emoji 开关、告警间隔、连接配置等）
- `whitelist_chats` — 已授权群白名单
- `pending_groups` — 待审批授权请求
- `audit_logs` — 操作审计日志（记录操作结果和失败信息）
- `state_cache` — 状态缓存（带 TTL）

## 项目结构

```text
src/
  bot/         Telegram 命令、回调、菜单和格式化
  config/      环境变量读取
  openclaw/    OpenClaw CLI 适配、输出解析、后端抽象、自动发现
  services/    业务服务层（12 个 service）
  storage/     SQLite 初始化与仓储（5 个 repo）
  types/       TypeScript 类型定义
scripts/
  copy-assets.mjs  构建后复制运行时资产
```

## 运行要求

- Node.js 20+
- 可用的 Telegram Bot Token
- 管理员 Telegram 用户 ID（支持多管理员）
- 本机可执行的 `openclaw` CLI（或 Docker / HTTP 端点）
- 可写的数据目录

## 环境变量

必填（二选一）：

- `ADMIN_TELEGRAM_ID` — 单个管理员 ID（兼容旧版）
- `ADMIN_TELEGRAM_IDS` — 多个管理员 ID，逗号分隔（推荐）

其他必填：

- `BOT_TOKEN`

可选：

- `TZ`，默认 `Asia/Shanghai`
- `DATA_DIR`，默认 `/app/data`
- `STATE_EMOJI_ENABLED`，默认 `true`
- `ALERT_CHECK_INTERVAL_SEC`，默认 `60`（可通过 Settings 动态调整）
- `OPENCLAW_BINARY`，默认 `openclaw`

参考样例见 [`.env.example`](./.env.example)。

## 本地开发

### 1. 安装依赖

```powershell
npm install
```

### 2. 配置环境变量

```powershell
Copy-Item .env.example .env
```

至少填写：

```env
BOT_TOKEN=your_telegram_bot_token
ADMIN_TELEGRAM_IDS=123456789,987654321
```

如果 `openclaw` 不在 `PATH` 中，补充：

```env
OPENCLAW_BINARY=C:\path\to\openclaw.exe
```

### 3. 开发模式

```powershell
npm run dev
```

### 4. 构建并运行

```powershell
npm run build
npm start
```

构建会自动复制运行时所需的 `schema.sql` 到 `dist/storage/`。

## Docker

项目提供 `Dockerfile` 和 `docker-compose.yml`。

```powershell
docker compose up -d --build
```

当前镜像基于 `node:20-bookworm-slim`，避免了 `better-sqlite3` 在 Alpine / `--ignore-scripts` 组合下的原生依赖问题。

### Docker 部署检查清单

```
[ ] 创建 .env 文件，填写 BOT_TOKEN 和 ADMIN_TELEGRAM_IDS
[ ] docker compose up -d --build
[ ] 验证 Bot 响应 /ping
[ ] 验证 /menu 菜单正常显示
[ ] 验证连接自动发现或手动配置连接
[ ] 验证一次状态查询操作
[ ] 验证告警通知是否送达所有管理员
```

## 已修复的问题

- 修复构建产物缺少 `schema.sql`，`dist` 现在可以完成数据库初始化
- 修复 Docker 安装链路，去掉 `--ignore-scripts`，并切换到 `bookworm-slim`
- 删除未接入执行链路的 `OPENCLAW_URL` / `OPENCLAW_TOKEN` 配置，明确项目为 CLI-only
- 修复 `STATE_EMOJI_ENABLED` 在运行时切换不生效的问题
- 修复 ACL 审批回调不支持负数 Telegram 群 ID 的问题
- 为状态概览缓存增加 TTL，避免长期返回过期结果
- 统一替换 Telegram 菜单和提示文案中的乱码
- 补全 Cron 任务菜单入口，使启用/禁用/执行按钮可达
- 将顶层菜单重构为 `状态查看`、`服务控制`、`管理授权` 三种模式
- 新增备份校验、恢复、删除功能及交互菜单
- 新增审计日志查看入口（最近操作 / 失败记录）
- 审计日志现在记录真实操作结果（success/failed）和失败信息
- 支持多管理员（`ADMIN_TELEGRAM_IDS` 逗号分隔）
- 新增 Settings 功能：连接状态查看、OpenClaw 版本、告警间隔动态调整
- 新增 `/cancel` 命令取消待处理操作
- 新增连接管理菜单：重新发现、重置连接

## Roadmap

| 状态 | 模块 | 功能 | 说明 |
|------|------|------|------|
| ✅ | Telegram 入口 | `/start` `/menu` `/id` `/ping` `/cancel` | 基本命令和菜单导航 |
| ✅ | 菜单架构 | 三种模式：状态查看 / 服务控制 / 管理授权 | 分层菜单 + 返回导航 |
| ✅ | 连接管理 | 自动发现（CLI / Docker / HTTP）+ 手动配置 | 连接持久化、重置、重新发现 |
| ✅ | 状态查看 | 概览 / 完整 / 深度状态 | 带缓存 TTL |
| ✅ | 健康检查 | Gateway 健康 / 全量健康 / 最近异常 | |
| ✅ | 连通性 | 通道探测 / Provider 探测 / Usage 状态 | |
| ✅ | 日志 | 最近日志 / 错误摘要 | 支持 JSON 过滤 |
| ✅ | 模型管理 | 当前模型 / 可用列表 / 切换默认模型 | 二次确认 + 审计 |
| ✅ | Doctor | 诊断 / 自动修复 | 自动探测 `--repair` / `--fix` / `-r` |
| ✅ | 定时任务 | 状态 / 列表 / 启用 / 禁用 / 执行 / 运行记录 | 逐项操作菜单 |
| ✅ | 备份管理 | 创建 / 列表 / 校验 / 恢复 / 删除 | 交互菜单 + 二次确认 |
| ✅ | 重启 | OpenClaw / Gateway 重启 | 二次确认 + 审计 |
| ✅ | ACL 审批 | 群授权申请 / 待审批列表 / 批准 / 拒绝 | 白名单管理 |
| ✅ | 审计日志 | 最近操作 / 失败记录 | 记录真实结果和错误信息 |
| ✅ | 系统设置 | 配置摘要 / 状态图标开关 / 连接状态 / 版本 / 告警间隔 | |
| ✅ | 告警监控 | 定时检查（状态/Gateway/Provider）→ 告警 → 恢复通知 | 多管理员通知 |
| ✅ | 多管理员 | `ADMIN_TELEGRAM_IDS` 逗号分隔 | 兼容旧版单管理员 |
| ✅ | 多后端 | local-cli / docker-cli / http-api | 统一接口抽象 |
| ✅ | 持久化 | SQLite 5 张表 | settings / whitelist / pending / audit / cache |
| ✅ | Docker | 多阶段构建 / healthcheck / 日志轮转 | `bookworm-slim` 镜像 |
| ✅ | 重启通知 | OpenClaw 重启后自动推送通知 | 包含启动时间、PID、使用模型、故障持续时间 |
| ✅ | 连接状态通知 | 工具与 OpenClaw 连通后主动发送状态提示 | 包含连接方式、运行状态、当前模型 |
| ✅ | 菜单扁平化 | /status /service /admin 三个独立命令 | 常规操作2步完成，危险操作二次确认 |
| ✅ | 回复模板美化 | templates.ts 17个结构化模板 | 键值对/编号列表替代原始代码块 |
| ✅ | 自动化测试 | Jest 框架，81 个测试用例 | 覆盖 parser/repos/services |
| ⬜ | 自动化测试 | 单元测试 + 集成测试 | |
| ⬜ | 备份定时任务 | 支持通过 Bot 配置自动备份周期 | |
| ⬜ | 多语言 | 中/英文切换 | |
| ⬜ | 版本管理 | 语义化版本号 + 更新日志 | package.json version 同步，CHANGELOG.md |
| ⬜ | 关于页面 | OpenClaw 监控状态 + 版本号展示 | 独立入口，快速查看系统信息 |
| ⬜ | 交互优化 | 点击反馈 / 错误模板化 / 结果刷新 / 分页查看 | 提升日常使用体验 |

## 当前限制

- 输出格式已结构化，但日志/错误类信息仍保留代码块展示（3500 字符截断）
