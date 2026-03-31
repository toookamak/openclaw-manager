# OpenClaw Connection Discovery Design

## 背景

当前项目的接入前提是 `manager` 所在环境必须能够直接执行本机 `openclaw` CLI。这个前提在以下场景中存在明显局限：

- `openclaw` 运行在 Docker 容器中，而 `manager` 不在同一容器
- `manager` 与 `openclaw` 不在同一主机或同一用户空间
- 部署后需要用户手动填写较多参数，例如端口、二进制路径、容器名

目标不是继续堆叠环境变量，而是改成：

- 默认自动发现
- 自动发现失败后，使用最少的人工输入完成绑定
- 一次配置成功后，后续所有命令都复用同一个连接 profile

## 目标

需要支持的用户体验：

1. 部署完成后，首次进入 Bot 时自动探测 OpenClaw
2. 如果探测成功，直接提示用户确认采用该连接方式
3. 如果探测失败，再让用户手动选择运行位置
4. 手动设置时，尽量只输入一个关键值，不要求反复填写端口、路径等多个参数

## 非目标

以下内容不应作为第一阶段目标：

- 不先实现多实例复杂编排
- 不在第一阶段引入大量环境变量
- 不把 `root` 路径作为默认部署模型
- 不在缺乏 OpenClaw 官方 HTTP API 规范时臆造完整 API 实现

## 建议的连接后端模型

建议把 OpenClaw 接入抽象为 3 类 backend：

### 1. local-cli

含义：

- 直接在当前运行环境执行 `openclaw`

适用场景：

- `manager` 和 `openclaw` 在同一主机
- 或 `manager` 和 `openclaw` 在同一容器

配置最小项：

- `command`

示例：

```json
{
  "type": "local-cli",
  "command": "openclaw"
}
```

或：

```json
{
  "type": "local-cli",
  "command": "/usr/local/bin/openclaw"
}
```

### 2. docker-cli

含义：

- 通过 Docker 定位目标容器，再在容器内执行 `openclaw`

适用场景：

- `openclaw` 运行在 Docker 中
- `manager` 运行在宿主机
- 或 `manager` 运行在另一个具备 Docker 控制能力的容器中

配置最小项：

- `container`

示例：

```json
{
  "type": "docker-cli",
  "container": "openclaw"
}
```

### 3. http-api

含义：

- 通过 HTTP API 与 OpenClaw 通信

适用场景：

- 跨主机部署
- 无法使用本机 CLI 或 Docker CLI
- OpenClaw 后续提供稳定 API

配置最小项：

- `baseUrl`

示例：

```json
{
  "type": "http-api",
  "baseUrl": "http://host.docker.internal:18789"
}
```

## 自动发现顺序

建议按以下顺序探测，一旦命中立即停止：

### 第 1 步：探测 local-cli

执行：

```bash
openclaw status
```

或使用候选路径列表：

- `openclaw`
- `/usr/local/bin/openclaw`
- `/usr/bin/openclaw`
- `/opt/openclaw/openclaw`

如果命令执行成功，则绑定为 `local-cli`。

### 第 2 步：探测 docker-cli

执行：

```bash
docker ps
```

筛选候选容器的优先规则：

- 容器名包含 `openclaw`
- image 名包含 `openclaw`
- label 存在类似 `app=openclaw`

然后对候选容器逐个尝试：

```bash
docker exec <container> openclaw status
```

如果成功，则绑定为 `docker-cli`。

### 第 3 步：探测常见 HTTP 地址

只探测少量高概率地址，不要求用户先填写 host/port：

- `http://127.0.0.1:18789`
- `http://localhost:18789`
- `http://host.docker.internal:18789`

如果健康检查成功，则绑定为 `http-api`。

## 自动发现失败后的手动设置

不建议让用户一次填写多项参数。应先让用户选择“OpenClaw 在哪里运行”，再根据选择只收最少信息。

### 选项 1：本机

只让用户填写：

- `openclaw` 可执行路径

允许的输入示例：

- `openclaw`
- `/usr/local/bin/openclaw`
- `/opt/openclaw/openclaw`
- `/root/openclaw`

### 选项 2：Docker

不建议先让用户手工输入容器名。

正确交互方式：

1. 先自动扫描容器列表
2. 再让用户从候选列表中点选一个容器

只保存：

- `container`

### 选项 3：HTTP 地址

只让用户输入：

- `baseUrl`

例如：

- `http://host.docker.internal:18789`

不要拆成 host、port、path 多个字段。

## 连接 profile 的持久化

建议新增专门的连接配置存储，而不是继续堆叠环境变量。

推荐在 SQLite 的 `settings` 表中新增统一键，例如：

- `openclaw_connection_profile`

保存 JSON：

```json
{
  "type": "docker-cli",
  "container": "openclaw"
}
```

或：

```json
{
  "type": "local-cli",
  "command": "/usr/local/bin/openclaw"
}
```

这样后续所有 OpenClaw 操作都读取同一个 profile，不需要每个功能重复猜测路径或端口。

## 推荐的代码重构方向

### 1. 增加 backend 抽象层

建议定义：

```ts
interface OpenClawBackend {
  kind: 'local-cli' | 'docker-cli' | 'http-api';
  exec(args: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
}
```

具体实现：

- `LocalCliBackend`
- `DockerCliBackend`
- `HttpApiBackend`

### 2. 增加 discovery-service

建议提供：

- `discoverLocalCli()`
- `discoverDockerContainers()`
- `discoverHttpEndpoints()`
- `discoverBestConnection()`

### 3. 改造 openclawCommands

当前 `openclawCommands` 直接依赖本地 `execCli()`，后续应改为依赖“当前激活的 backend”。

也就是：

- 不再固定绑定本机 CLI
- 由 active profile 决定走 `local-cli`、`docker-cli` 或 `http-api`

### 4. 增加首次接入引导

建议在 Telegram 中提供首次接入流程：

1. 自动发现
2. 展示发现结果
3. 用户确认采用
4. 若失败则进入手动绑定

## Docker 场景说明

### 场景 A：manager 和 openclaw 在同一容器

最简单，直接使用 `local-cli`。

### 场景 B：manager 在宿主机，openclaw 在 Docker

建议使用 `docker-cli` 自动发现容器并执行：

```bash
docker exec <container> openclaw status
```

### 场景 C：manager 在 Docker，openclaw 也在 Docker

可选方案：

1. 推荐：挂载 Docker socket，并在容器内具备 Docker CLI 或 Docker API 访问能力
2. 次选：如果 OpenClaw 暴露稳定 HTTP API，则使用 `http-api`

如果既没有 Docker socket，也没有 HTTP API，且不在同一容器，那么 manager 无法自动介入。

## 关于 root 路径

`/root/...` 路径可以作为兼容输入，但不建议作为默认部署模型。

原因：

- 仅 root 用户可直接访问
- 不利于后续 systemd、Docker、非 root 用户运行
- 容器环境通常无法直接访问宿主机 `/root/...`

结论：

- 可以支持用户手动填写 `/root/openclaw`
- 但默认自动探测应优先使用更通用的路径，例如 `/usr/local/bin/openclaw`

## 推荐的交互文案方向

首次自动发现成功：

- `已识别到 OpenClaw 运行环境：Docker 容器 openclaw`
- `是否采用该连接方式？`

自动发现失败：

- `未自动识别到 OpenClaw，请选择运行位置`

按钮：

- `本机`
- `Docker`
- `HTTP 地址`

## 总结

后续演进目标应从“要求用户预先知道路径和端口”转向：

- 自动发现优先
- 最小人工设置兜底
- 使用统一 connection profile 持久化
- 通过 backend 抽象支持 `local-cli` / `docker-cli` / `http-api`

这是比当前 CLI-only 模型更适合真实部署环境的方向。
