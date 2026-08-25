# @bwrong/codepulse

CodePulse 编码时间采集 CLI：向 [WakaTime](https://wakatime.com/) 上报终端 / CLI 编码心跳，附带 zsh 插件。与官方 WakaTime 编辑器插件同源同后端、同项目命名，CodePulse 面板零改动即可展示终端编码时间。

## 安装

```sh
npm i -g @bwrong/codepulse
codepulse init-zsh   # 在 ~/.zshrc 中启用 zsh 插件（会先征求确认）
```

## 用法

```sh
# 手动发送一条心跳
codepulse heartbeat --project my-project --entity "npm run dev" --write

# 只打印请求，不发送
codepulse heartbeat --project test --dry-run
```

zsh 插件安装后：每次敲命令即发心跳，codex / claude code 等长驻 CLI 工具在运行期间每 60s 周期心跳，编码时间可完整统计。

## 文档

详见 [docs/shell-tracking.md](docs/shell-tracking.md)。
