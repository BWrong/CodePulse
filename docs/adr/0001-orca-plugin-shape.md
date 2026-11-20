# 0001 Orca 插件的形态与边界

Orca 版 CodePulse（`packages/orca`）要回答一个问题：在一个没有状态栏点击回调、面板帧没有网络的
宿主上，怎么把 VS Code 版的功能搬过来。

## 决定

- **`trusted-worker` + HTML 面板**：WakaTime 请求只能由插件的 Node worker 发（面板帧 CSP 是
  `connect-src 'none'`），面板用 `ui: "html"`，因为 uPlot 要自己画 canvas。
- **面板只放右侧栏，状态栏不挂点击**：`statusBarItems` 支持 `command`，但三种「点一下就到面板或网页」
  的路都不通——Orca 没有「打开某个插件面板」的内置动作（`commands[].action` 与 `commands.run` 只有
  14 个内置动作）、插件无法用代码选中自己的面板、`shell.openExternal` 的 `surfaces` 只有
  `panel | editor` 且要求帧内手势（状态栏点击走的是 worker）。所以状态栏只显示今日时长，面板从右侧栏
  图标进入，打开 WakaTime 网页的入口是面板右上角的外链按钮。
- **uPlot 的 JS/CSS 内联进 `src/panel.html`**：面板 CSP 的 `script-src`/`style-src` 只有
  `'unsafe-inline'`，没有 `'self'`，外链 `<script src>` 与 `<link rel=stylesheet>` 都会被拦。
- **面板与 worker 之间沿用 VS Code 的消息协议**：面板里保留 `window 'message'` + `switch(command)`
  那套渲染代码，只在入口加一层 shim：`postMessage({command,...})` → `plugin.request(command,...)`，
  worker 回来的消息数组逐条派发成 `message` 事件。这样 `packages/vscode/src/dashboard.ts` 的
  1800 行前端逻辑不用重写。
- **主题变量换名**：`--vscode-*` → `--orca-*`（`--orca-background/foreground/muted-foreground/border/
  primary/card/popover/destructive/font-sans`），保留原深色回退值。
- **状态与凭证**：面板打开范围、缓存按面板 id 分开存 worker 内存；`lastRecordedDate` 进
  `orca.storage`，token 进 `orca.secrets`，项目最小时长走 `contributes.settings`。

## 代价

- 项目最小时长不再编译进 HTML，改由每次 `update` 消息携带（面板侧仍是同一个
  `MIN_PROJECT_SECONDS` 变量，只是从 `const` 变 `let`）。
- 采集器里 `~/.wakatime.cfg` 的裸文件读取需要自己声明 `fs`/`os` 类型（Orca 的 typeRoots 只含
  `.orca/types`，不随附 Node 类型），见 `packages/orca/src/node.d.ts`。
- WakaTime 客户端从 `https.request` 换成全局 `fetch`，行为（非 2xx 报错、15 秒超时）保持一致。
- **`settings.get()` 的返回形状在 1.4.265 上不一致**：`.orca/types/orca-services/index.d.ts:106` 声明的是
  `{ settings }`，`orca/testing` 的 `mockHost` 给的是裸键值表。`panelSettings` 两种都认
  （`raw.settings ?? raw`），不然后台按默认值走、用户在设置里改的阈值无效。
- **worker 的返回值必须是严格 JSON**：Orca 用 JSON schema 校验 handler 的响应，对象里只要有值为
  `undefined` 的键（例如 `lastRecordedDate` 还没存过），整个响应就被拒成
  `action_failed: ... answered with a non-JSON value`。所以 `updateMessage` 只在有值时放
  `lastRecordedDate`，`src/worker.test.ts` 用 `JSON.parse(JSON.stringify(result))` 做回环断言防回归。
