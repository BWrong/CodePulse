# CodePulse

CodePulse 是 monorepo，包含三个同级的独立功能包：


| 包                      | 功能                                                                               | 入口                                                               |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/vscode`      | VS Code 插件：按项目汇总查看编码时间                                                           | [packages/vscode/README.md](packages/vscode/README.md)           |
| `packages/codepulse`   | 终端编码时间采集：CLI + zsh 插件（废弃，改用各 agent 的插件更加精确，wakatime 有提供 ClaudeCode，Codex，Pi 的插件） | [packages/codepulse/README.md](packages/codepulse/README.md)     |
| `packages/pi-wakatime` | Pi 插件：通过 WakaTime CLI 同步 AI 编码活动（废弃，社区有现成的了，不再重复造轮子）                             | [packages/pi-wakatime/README.md](packages/pi-wakatime/README.md) |


## 本地开发（VS Code 插件）

不需要任何 VS Code 工程配置，全程在终端完成：

```bash
cd packages/vscode
npm install        # 首次

# 终端 A：常驻，保存 TS 后自动编译到 out/
npm run watch

# 终端 B：拉起 Extension Development Host 调试窗口（启动一次即可）
npm run dev
```

之后每次改完代码，刷新 Extension Development Host 窗口即可生效（`⌘R`，Windows/Linux 为 `Ctrl+R`）。也可以直接在终端敲：

```bash
npm run reload       # 激活 VS Code 窗口并发 ⌘R，省得手动切窗口（仅 macOS）
```

> `npm run reload` 作用于**最前面**的那个 VS Code 窗口；如果同时开着别的 VS Code 窗口，先切到调试窗口再执行。首次运行需要在 系统设置 → 隐私与安全性 里给终端授权「自动化」+「辅助功能」。
>
> `npm run dev` 只在启动时编译一次（`predev`）。长期迭代必须让终端 A 的 `npm run watch` 一直挂着，否则改动不会进 `out/`。

### 调试 Dashboard 样式与交互

Dashboard 的 HTML/CSS/JS 全部内联在 `src/dashboard.ts` 的 `getHtmlForWebview()` 中，调样式不必反复刷新：

1. 在 Extension Development Host 窗口按 `⇧⌘P` → **Developer: Open Webview Developer Tools**
2. 在 Elements / Console 面板直接改动，实时预览
3. 满意后把改动回写进 `src/dashboard.ts`

扩展侧逻辑（collector、消息处理、`activate` 等）运行的是 `out/*.js` 产物，必须刷新窗口才会重新加载。

### 数据来源

调试窗口读取的是本机真实的 `~/.wakatime.cfg`，因此需要先安装并登录 [WakaTime](https://wakatime.com/) 的 VS Code 插件，否则打开面板会提示「未找到 WakaTime API Key」。

## 需求文档

详见 [docs/spec.md](docs/spec.md)。