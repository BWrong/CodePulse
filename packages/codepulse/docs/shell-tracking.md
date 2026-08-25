# CodePulse 终端 CLI 编码时间采集（Shell Tracking）

## 背景

CodePulse 面板只展示官方 WakaTime 编辑器插件采集的心跳，因此只能统计 VS Code / Cursor 里的编码时间。终端里的编码行为（vim、npm、git、跑测试等）完全统计不到。

本文档实现终端采集：**敲命令 = 活跃**，向 WakaTime 发送心跳。与编辑器心跳**同源、同后端、同项目命名**，CodePulse 面板无需任何改动即可展示 CLI 时间。

## 架构

```
终端 (zsh)
  │  preexec / precmd 钩子
  ▼
shell/codepulse.zsh  ──►  bin/codepulse（统一上报 CLI）
                                │  读 ~/.wakatime.cfg 的 api_key
                                ▼
        POST https://api.wakatime.com/api/v1/users/current/heartbeats.bulk
                                ▼
                      wakatime.com 后端 ──► CodePulse 面板
```

## 工作原理

- **触发时机**：zsh `preexec`（敲下命令）记录命令，并启动后台循环**周期性发送心跳**（默认每 60s）；`precmd`（命令结束、提示符回来）停止循环并补发一条结束心跳。因此 codex / claude code 等长驻交互式 CLI 工具的编码时间也能被完整统计。
- **项目 id**：取 `git rev-parse --show-toplevel` 的文件夹名（如 `codePulse`），非 git 目录退回当前文件夹名——与官方 WakaTime 编辑器插件的项目命名一致，两处心跳归到同一项目。
- **心跳模型**：与 WakaTime 一致——连续活跃自动合并，停止 5 分钟后断开。常驻任务（dev server / watch）在命令运行期间持续计入；直接关闭终端时后台循环检测到父 zsh 退出后自行终止，不会持续发心跳。
- **离开检测（方案 B）**：macOS 下检测「锁屏 / 显示器睡眠」（前台变为 loginwindow 或 DevicePowerState=0），期间暂停心跳、解锁/唤醒后恢复——锁屏离开的时间不会算入编码时长；**长任务运行期间无输入不受影响**（照常计入）。可用 `CODEPULSE_SCREEN_CHECK=0` 关闭检测。
- **旁路**：心跳后台发送，不阻塞终端；失败静默（不影响敲命令）。

## 安装

1. 将 `bin/codepulse` 加入 PATH（推荐软链到 `~/.local/bin`）：
   ```sh
   ln -s /Users/bwrong/0WorkSpace/00.Misthin/codePulse/packages/codepulse/bin/codepulse ~/.local/bin/codepulse
   ```
2. 在 `~/.zshrc` 末尾加一行：
   ```sh
   source /Users/bwrong/0WorkSpace/00.Misthin/codePulse/packages/codepulse/shell/codepulse.zsh
   ```
3. 重开终端（或 `source ~/.zshrc`）生效。cli 不可用时不挂钩子，无副作用。

## 验证

```sh
# 只打印请求，不真正发送
codepulse heartbeat --project test --dry-run

# 模拟验证：打开 codex / claude code 待一会儿再退出，
# wakatime / CodePulse 面板应能看到该项目的连续时长

# 冒烟测试（7 项：项目探测 / JSON 转义 / 鉴权 / 插件触发）
bash /Users/bwrong/0WorkSpace/00.Misthin/codePulse/packages/codepulse/test/run.sh
```

## CLI 用法

```
codepulse heartbeat [选项]
  --project <name>   项目名（默认自动探测 git root / 文件夹名）
  --entity <str>     实体：命令字符串或文件路径（默认当前目录）
  --type <type>      实体类型: app|file|url|domain（默认 app）
  --category <cat>   活动类别，默认 coding
  --write            标记为写入动作
  --branch <name>    分支名（默认自动探测）
  --time <ts>        心跳 Unix 时间戳（默认当前时间）
  --dry-run          仅打印请求
```

## 配置

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `WAKATIME_API_KEY` | 读 `~/.wakatime.cfg` | 覆盖 api_key |
| `WAKATIME_CONFIG` | `~/.wakatime.cfg` | 配置文件路径 |
| `WAKATIME_API_URL` | `https://api.wakatime.com/api/v1` | WakaTime API 基址 |
| `CODEPULSE_CLI` | `codepulse` | cli 命令或绝对路径 |
| `CODEPULSE_INTERVAL` | `60` | 长驻命令的周期心跳间隔（秒） |
| `CODEPULSE_SCREEN_CHECK` | `1` | 锁屏/睡眠检测开关，`0` 关闭 |
| `CODEPULSE_TIMEOUT` | `5` | 请求超时（秒） |
| `CODEPULSE_PLUGIN` | `codepulse-cli/0.1.0` | User-Agent 标识 |

## 汇总表

| 文件 | 作用 | 依赖 | 备注 |
| --- | --- | --- | --- |
| `bin/codepulse` | 统一上报 CLI：读 key、构造心跳、POST heartbeats.bulk | bash + curl + python3（仅转义） | 零 npm 依赖 |
| `shell/codepulse.zsh` | zsh 插件：preexec/precmd 钩子，敲命令发心跳 | zsh（内置 datetime 模块）+ cli | cli 缺失时自动不挂载 |
| `test/run.sh` | 冒烟测试 | bash + git + zsh | 7 项断言 |
| `docs/shell-tracking.md` | 本文档 | — | — |
