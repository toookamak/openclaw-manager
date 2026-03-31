# OpenClaw Manager

`OpenClaw Manager` 是一个基于 `Telegram Bot + OpenClaw CLI + SQLite` 的运维管理工具。它通过 Telegram Inline Keyboard 暴露常用运维动作，所有实际操作都通过本机 `openclaw` CLI 执行。

项目当前定位是轻量级 CLI 控制入口，不包含独立的 OpenClaw HTTP API 集成。

## 功能概览

### Telegram 入口

- `/start`：显示帮助信息
- `/menu`：打开管理菜单
- `/id`：查看当前 `chat_id` 和 `user_id`
- `/ping`：检查 Bot 在线状态

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
- 备份列表：`openclaw backup list`
- 重启 OpenClaw：`openclaw restart`
- 重启 Gateway：`openclaw gateway restart`

### ACL 与审批

- 查询当前群/用户 ID
- 查询当前群授权状态
- 当前群提交授权申请
- 管理员审批待授权群
- 白名单增删

### 本地持久化

SQLite 数据库位于 `DATA_DIR/openclaw-manager.db`，当前表包括：

- `settings`
- `whitelist_chats`
- `pending_groups`
- `audit_logs`
- `state_cache`

## 项目结构

```text
src/
  bot/         Telegram 命令、回调、菜单和格式化
  config/      环境变量读取
  openclaw/    OpenClaw CLI 适配与输出解析
  services/    业务服务层
  storage/     SQLite 初始化与仓储
  types/       TypeScript 类型
scripts/
  copy-assets.mjs  构建后复制运行时资产
```

## 运行要求

- Node.js 20+
- 可用的 Telegram Bot Token
- 管理员 Telegram 用户 ID
- 本机可执行的 `openclaw` CLI
- 可写的数据目录

## 环境变量

必填：

- `BOT_TOKEN`
- `ADMIN_TELEGRAM_ID`

可选：

- `TZ`，默认 `Asia/Shanghai`
- `DATA_DIR`，默认 `/app/data`
- `STATE_EMOJI_ENABLED`，默认 `true`
- `ALERT_CHECK_INTERVAL_SEC`，默认 `60`
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
ADMIN_TELEGRAM_ID=your_telegram_user_id
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

## 已修复的问题

- 修复构建产物缺少 `schema.sql`，`dist` 现在可以完成数据库初始化
- 修复 Docker 安装链路，去掉 `--ignore-scripts`，并切换到 `bookworm-slim`
- 删除未接入执行链路的 `OPENCLAW_URL` / `OPENCLAW_TOKEN` 配置，明确项目为 CLI-only
- 修复 `STATE_EMOJI_ENABLED` 在运行时切换不生效的问题
- 修复 ACL 审批回调不支持负数 Telegram 群 ID 的问题
- 为状态概览缓存增加 TTL，避免长期返回过期结果
- 统一替换 Telegram 菜单和提示文案中的乱码
- 补全 Cron 任务菜单入口，使启用/禁用/执行按钮可达

## 当前限制

- 仍然没有自动化测试；当前验证以 `tsc` 构建和启动关键路径 smoke test 为主
- 审计日志依旧只记录“操作触发”，没有细分底层 CLI 返回码
- 输出格式主要适配 Telegram Markdown，复杂长文本仍以代码块截断展示

## 验证

本次修复后已完成：

- `npm.cmd run build`
- 验证 `dist/storage/schema.sql` 已生成
- 直接调用 `dist/storage/db.js` 的 `initDb()`，确认数据库初始化成功
