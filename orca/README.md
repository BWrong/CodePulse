# CodePulse for Orca

Orca 版 CodePulse：状态栏显示今日编码时长，右侧栏 CodePulse 面板里看按项目汇总的编码时间、
未记录时长与 AI 代码占比。数据仍来自 WakaTime，功能对齐 `vscode/`。

## 形态

- `src/worker.ts`：Node 进程，唯一能发网络请求的地方（面板帧 `connect-src 'none'`）。
  代面板读 WakaTime，并把今日时长推给状态栏（`statusBar.update`，每 5 分钟一次）。
- `src/panel.html`：右侧栏面板，从 VS Code 版 `dashboard.ts` 的内嵌页面搬来。渲染逻辑一行未改，改的是：
  `vscode.postMessage` 换成向 worker 发 `plugin.request`、`--vscode-*` 主题变量换成 `--orca-*`、
  项目最小时长与「未记录项目」开关改为运行时由 worker 下发，以及只属于 Orca 的三处 UI——时间范围
  改成下拉、右上角三个按钮改成图标、新增顶部凭证输入条（面板窄，原来的 tab 和文字按钮放不下）。
- `src/collectors/`：WakaTime 采集与聚合，与 VS Code 版逐行一致（除 api 客户端改用全局 `fetch`）。
- 状态栏：只显示今日时长，不挂点击（Orca 没有「打开插件面板」的内置动作，`shell.openExternal` 也不对 worker 开放）；面板从右侧栏的 CodePulse 图标进入，面板右上角的外链按钮打开 WakaTime。

## 凭证

WakaTime 从 2026-11-01 起 API Key 只用于上报心跳，读数据必须用个人 OAuth Token
（[wakatime.com/oauth](https://wakatime.com/oauth) 直接复制，不用建 OAuth app）。

面板顶部的「凭证」按钮展开输入框，粘贴后存进插件自己的 secrets（加密文件）；
没填时回退读 `~/.wakatime.cfg` 的 `api_key`，但那种 key 现在读不了数据，只会得到 403。

## 设置

插件设置里可改两项：`minProjectDurationMinutes`（默认 10，项目最小可见时长）与
`showUnrecordedProjects`（默认关闭，是否显示「未记录项目」模块）。改动在下一次面板加载或刷新时生效。

## 数据存放

全部在 `~/Library/Application Support/Orca/plugins-data/local.codepulse/`：

- `storage.json`：“记录完成”的时刻（`lastRecordedDate`，`orca.storage`）。与 VS Code 版的
  `globalState` 不同，它不随 Settings Sync 同步，删插件就一起没了。
- `secrets.json.enc`：WakaTime OAuth Token（`secrets:own`，加密文件）。
- `settings.json`：本插件两项设置。

## 开发

```sh
npm install            # 只为 tsc
npm run typecheck      # tsc -p .
npm run validate       # orca plugin validate .
npm test               # orca plugin test .
npm run load           # 首次加载需要 --approve <指纹>，见输出
npm run dev            # watch + check + 截图到 .orca/shots
```

首次加载插件会在 Orca 里请求授权（它跑自己的代码、读几个自己的存储/设置），需要手动确认指纹。
`.orca/types/`（`orca`、`orca/testing` 等类型声明）是 Orca 生成的、被 `.gitignore` 挡掉，所以新克隆的仓库要先
跑一次 `npm run load` 才能 `npm run typecheck`。
面板截图：`orca plugin shot local.codepulse --panel dashboard`，状态栏截图加 `--status-bar`。
