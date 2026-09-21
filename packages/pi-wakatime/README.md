# @bwrong/pi-wakatime

Pi 的 WakaTime AI 编码活动采集插件。

插件不自己解析 Pi session，也不按固定间隔发送心跳。它只在一轮 agent 完成或 Pi 退出时调用：

```sh
wakatime-cli --sync-ai-activity
```

实际 heartbeat 由 WakaTime CLI 的 Pi parser 根据 `~/.pi/agent/sessions` 生成，因此可以记录 prompt、模型、token、AI 修改行数和文件，同时避免空闲等待时间被误算。

## 前置条件

- Pi `0.86.1` 或兼容版本
- 包含 Pi parser 的 `wakatime-cli`
- `~/.wakatime.cfg` 中已配置 `api_key`

WakaTime 编辑器插件通常已经安装 `wakatime-cli`。如果不是默认路径，可以通过 `WAKATIME_CLI` 指定：

```sh
export WAKATIME_CLI=/path/to/wakatime-cli
```

## 安装

本地开发或从仓库安装：

```sh
pi install /absolute/path/to/CodePulse/packages/pi-wakatime
```

临时加载：

```sh
pi -e /absolute/path/to/CodePulse/packages/pi-wakatime
```

发布到 npm 后可安装：

```sh
pi install npm:@bwrong/pi-wakatime
```

## 行为

- `agent_settled`：一轮 agent 完全结束、没有自动重试或后续队列时同步活动。
- `session_shutdown`：退出、切换、恢复或 fork session 前补一次同步。
- 同步进程 detached 并立即返回，不阻塞 Pi。

## 排查

查看 WakaTime CLI 日志：

```sh
tail -f ~/.wakatime/wakatime.log
```

在 `~/.wakatime.cfg` 中启用调试：

```ini
[settings]
debug = true
```

当前 WakaTime CLI 的 Pi parser 扫描默认目录 `~/.pi/agent/sessions`。使用 `PI_CODING_AGENT_DIR` 或 `--session-dir` 自定义 session 目录时，需要等待 WakaTime CLI 增加对应目录配置。
