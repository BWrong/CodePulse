 # CodePulse Spec

 ## Problem Statement

 The user wants to track their own coding time inside VS Code, aggregated by project, over 7/30/90-day windows. The primary goal is to support project cost accounting: the user periodically copies project totals into a Tencent Docs spreadsheet that tracks per-member hours. Existing solutions like WakaTime do not integrate with Tencent Docs, so the user needs a custom VS Code extension that:

 - Shows total coding time, daily average, a trend chart, and a project breakdown for the selected time window.
 - Provides a lightweight "manual bookkeeping aid" that records the last day the user has already copied to the cost sheet, so they know where to resume next time.
 - Avoids paid subscriptions for historical data while still working across multiple machines.

 ## Solution

 Build a VS Code extension named **CodePulse** that:

 1. Depends on the existing WakaTime VS Code extension for heartbeat collection and project detection.
 2. Reuses the WakaTime API key stored in `~/.wakatime.cfg` so the user does not need to configure another key.
 3. Calls the WakaTime `/api/v1/users/current/summaries` endpoint to fetch 7/30/90 days of summaries.
 4. Renders a single lightweight dashboard inside a VS Code Webview using plain HTML/CSS/TypeScript and the uPlot charting library.
 5. Adds a status bar item that shows today's coding time and opens the dashboard when clicked.
 6. Persists the "last recorded date" in `ExtensionContext.globalState` and explicitly registers it for sync with `setKeysForSync`, so the bookkeeping marker follows the user across machines via VS Code Settings Sync.
 7. Leaves the door open for a future local collector by defining an abstract `collector` interface; the first implementation is a WakaTime API adapter.

 ## User Stories

 1. As a developer, I want to see my total coding time for the last 7, 30, or 90 days inside VS Code, so that I can estimate project effort without leaving the editor.
 2. As a developer, I want to see my average coding time per day for the selected window, so that I can understand my daily cadence.
 3. As a developer, I want a bar chart showing daily coding time for the selected window, so that I can spot spikes and dips at a glance.
 4. As a developer, I want a project list with total hours and a percentage/progress bar for the selected window, so that I can copy each project's total into the cost sheet.
 5. As a developer, I want to click a "Mark today as recorded" button in the dashboard, so that I remember I have already copied today's data to the cost sheet.
 6. As a developer, I want the dashboard to display the last recorded date, so that I know where to resume manual bookkeeping next time.
 7. As a developer, I want the last recorded date to sync across my machines via VS Code Settings Sync, so that I do not re-record the same day on a different laptop.
 8. As a developer, I want a status bar item showing today's coding time, so that I have a quick at-a-glance view and can hide the WakaTime status bar item.
 9. As a developer, I want the dashboard to refresh automatically when opened, so that I see the latest data without extra clicks.
 10. As a developer, I want a manual refresh button in the dashboard, so that I can update the view after a coding session.
 11. As a developer, I want to see a clear text message when the WakaTime plugin is missing or unconfigured, so that I know how to fix the dependency.
 12. As a developer, I want to see a clear text message when the WakaTime API request fails, so that I can check my network or proxy.
 13. As a developer, I want a link to the WakaTime website from the dashboard, so that I can quickly open my WakaTime dashboard if needed.
 14. As a developer, I want the extension to use the same project names as WakaTime (Git repository names), so that I do not need to maintain a project mapping.
 15. As a developer, I want the extension to work without sending my code stats to any new server, so that I can keep relying on WakaTime for collection while only adding a local presentation layer.
 16. As a developer, I want the data collection abstraction to be replaceable, so that I can switch to a local collector if WakaTime restrictions or pricing change in the future.
 17. As a developer, I want the dashboard to be a single page without a complex build pipeline, so that the extension is easy to maintain and debug.
 18. As a developer, I want the charting library to be small and fast, so that the dashboard loads quickly inside a Webview.
 19. As a developer, I want the 7/30/90-day selector to be a global tab bar at the top of the dashboard, so that all modules switch ranges together.
 20. As a developer, I want an empty state when no coding time exists for the selected range, so that I understand the difference between "no data" and "loading failed".

 ## Implementation Decisions

 - **VS Code Extension Host**: The extension runs in the VS Code extension host. It reads `~/.wakatime.cfg`, fetches WakaTime summaries, and exposes a dashboard command.
 - **Collector Abstraction**: Define a `TimeCollector` interface with methods like `getSummaries(start: Date, end: Date)` returning a normalized summary shape. The first implementation is `WakaTimeCollector`.
 - **WakaTime Collector**: Reads the `api_key` from the `[settings]` section of `~/.wakatime.cfg` using HTTP Basic Auth against `https://wakatime.com/api/v1/users/current/summaries`.
 - **Dashboard Webview**: A single Webview panel with a global 7/30/90 tab selector. It uses plain HTML/CSS/TypeScript and uPlot for the bar chart. Data is passed via `postMessage`.
 - **Aggregation**: The extension host aggregates daily totals and project totals from the WakaTime summaries response before sending them to the Webview.
 - **Status Bar**: A status bar item shows today's coding time in `Xh Ym` format. Clicking it opens the dashboard.
 - **Bookkeeping Marker**: `lastRecordedDate` is stored as an ISO date string in `ExtensionContext.globalState`. The activation code calls `globalState.setKeysForSync(['lastRecordedDate'])` so VS Code Settings Sync propagates it.
 - **No Local Cache**: The dashboard fetches data every time it is opened or refreshed. No persistent local cache is implemented for this MVP.
 - **No Tencent Docs Integration**: Pushing data to Tencent Docs is explicitly out of scope for this MVP. The user will continue to manually copy values from the project list.
 - **No Custom Project Mapping**: WakaTime project names are used directly because the user's cost sheet is one-repository-one-project.
 - **Error Handling**: Missing config or API failures are surfaced as plain text messages inside the dashboard with a retry button.

 ## Testing Decisions

 - **Unit Tests for Aggregation**: The module that transforms raw WakaTime summaries into daily totals and project totals should be unit tested with mocked WakaTime responses.
 - **Manual Webview Tests**: The Webview rendering and uPlot chart will be validated manually by opening the dashboard in VS Code and switching the 7/30/90 tabs.
 - **Manual Integration Tests**: Fetching real WakaTime data will be verified manually with the user's API key across the supported ranges.
 - **Settings Sync Test**: Verify that `lastRecordedDate` set on one machine appears after VS Code Settings Sync on another machine.
 - **No Tests for VS Code Extension API Glue**: The extension host command registration, Webview creation, and `postMessage` wiring are considered thin glue and will be covered by manual end-to-end tests rather than unit tests.
 - **No Tests for WakaTime API Client**: The actual HTTP client to WakaTime is treated as a simple adapter; failures are handled by the error path and verified manually.

 ## Out of Scope

 - Automatic synchronization with Tencent Docs or any other spreadsheet.
 - Local heartbeat collection (the current MVP relies on WakaTime).
 - Editing or manually adding time entries.
 - Per-file or per-language breakdown.
 - Custom project name mapping or renaming.
 - Caching of WakaTime responses to reduce API calls.
 - OAuth-based authentication to WakaTime (uses the existing API key in `~/.wakatime.cfg`).
 - Leaderboards, public profiles, or team features.
 - Mobile or browser support.

 ## Further Notes

 - The WakaTime Free plan dashboard is limited to one week of history, but the API was verified to return at least 90 days of summary data for the user's free account. The implementation relies on this API behavior.
 - The user confirmed that the project names WakaTime derives from Git repository names map directly to the projects in the cost sheet.
 - The user already has a proxy and can reach `wakatime.com` from their machine; the extension will not bundle a proxy.
 - The user wants to hide the WakaTime status bar item after CodePulse provides its own status bar item. The extension will not modify WakaTime settings; hiding WakaTime's status bar is left to the user via WakaTime's own preferences.
 # CodePulse 产品需求文档

 ## 问题陈述

 用户希望在 VS Code 中追踪自己的编码时间，并按项目汇总查看 7/30/90 天的数据。主要目的是辅助项目成本核算：用户会定期把各项目的总工时抄到一个腾讯文档的工时统计表中。现有的 WakaTime 等方案不支持同步到腾讯文档，因此需要一个定制的 VS Code 插件，满足以下需求：

 - 在选定时间范围内展示总编码时长、平均每天时长、时间趋势图和项目视图。
 - 提供一个轻量的“抄表辅助”功能，记录用户已经把数据抄到成本表的最后一天，方便下次知道从哪里继续抄。
 - 不需要为历史数据付费，同时能在多台电脑上使用。

 ## 解决方案

 开发一个名为 **CodePulse** 的 VS Code 插件：

 1. 依赖现有的 WakaTime VS Code 插件来采集心跳和识别项目。
 2. 复用 WakaTime 插件存储在 `~/.wakatime.cfg` 中的 API Key，无需用户额外配置。
 3. 调用 WakaTime 的 `/api/v1/users/current/summaries` 接口获取 7/30/90 天的汇总数据。
 4. 在 VS Code Webview 中渲染一个轻量的单页面板，使用原生 HTML/CSS/TypeScript 和 uPlot 图表库。
 5. 在状态栏显示今日编码时长，点击后打开面板。
 6. 将“最后记录日期”保存在 `ExtensionContext.globalState` 中，并通过 `setKeysForSync` 显式声明需要同步，使其跟随 VS Code 设置同步跨设备生效。
 7. 定义抽象的 `collector` 采集接口，当前实现为 WakaTime API 适配器，后续可替换为本地采集。

 ## 用户故事

 1. 作为一名开发者，我希望在 VS Code 内查看最近 7/30/90 天的总编码时长，以便估算项目投入。
 2. 作为一名开发者，我希望看到选定时间范围内的平均每天编码时长，以便了解自己的编码节奏。
 3. 作为一名开发者，我希望看到选定时间范围内的每日编码时长柱状图，以便快速发现高峰和低谷。
 4. 作为一名开发者，我希望看到项目列表及每个项目的总时长和占比进度条，以便把各项目工时抄到成本表。
 5. 作为一名开发者，我希望点击“标记今天已记录”按钮，以便记住今天已经抄过表。
 6. 作为一名开发者，我希望面板显示上次记录日期，以便下次知道从哪天开始补抄。
 7. 作为一名开发者，我希望最后记录日期能通过 VS Code 设置同步跨设备保持一致，以免换电脑后重复抄录。
 8. 作为一名开发者，我希望状态栏显示今日编码时长，以便一眼看到当天投入，并可以隐藏 WakaTime 的状态栏图标。
 9. 作为一名开发者，我希望打开面板时自动刷新数据，无需手动操作。
 10. 作为一名开发者，我希望面板内有手动刷新按钮，以便编码结束后主动更新视图。
 11. 作为一名开发者，我希望在未安装或未配置 WakaTime 插件时看到明确提示，以便知道如何修复依赖。
 12. 作为一名开发者，我希望在 WakaTime API 请求失败时看到明确提示，以便检查网络或代理。
 13. 作为一名开发者，我希望面板内提供 WakaTime 官网入口，方便需要时打开 WakaTime 控制台。
 14. 作为一名开发者，我希望插件直接使用 WakaTime 的项目名（Git 仓库名），无需维护项目映射。
 15. 作为一名开发者，我希望插件不会把编码数据发送到新的服务端，只依赖 WakaTime 做采集，本地只做展示。
 16. 作为一名开发者，我希望采集层是可替换的，以便 WakaTime 限制或涨价后可以切换到本地采集。
 17. 作为一名开发者，我希望面板是单页结构，构建流程简单，便于维护和调试。
 18. 作为一名开发者，我希望图表库轻量快速，Webview 加载不卡顿。
 19. 作为一名开发者，我希望 7/30/90 天的时间选择器位于面板顶部，作为全局切换，所有模块联动。
 20. 作为一名开发者，我希望在选定时间范围内没有数据时看到空状态，以便区分“无数据”和“加载失败”。

 ## 实现决策

 - **VS Code 扩展宿主**：插件运行在 VS Code 扩展宿主中，负责读取 `~/.wakatime.cfg`、请求 WakaTime 数据、注册打开面板的命令。
 - **采集器抽象**：定义 `TimeCollector` 接口，例如 `getSummaries(start: Date, end: Date)`，返回规范化的汇总数据结构。首个实现为 `WakaTimeCollector`。
 - **WakaTime 采集器**：从 `~/.wakatime.cfg` 的 `[settings]` 段读取 `api_key`，使用 HTTP Basic Auth 请求 `https://wakatime.com/api/v1/users/current/summaries`。
 - **Dashboard Webview**：单个 Webview 面板，顶部有全局 7/30/90 tab 切换。使用原生 HTML/CSS/TypeScript 和 uPlot 绘制柱状图。数据通过 `postMessage` 传递。
 - **数据聚合**：扩展宿主在把数据发给 Webview 前，先对 WakaTime 返回的每日数据按天和按项目做聚合。
 - **状态栏**：状态栏项显示今日编码时长，格式为 `Xh Ym`，点击打开面板。
 - **抄表标记**：`lastRecordedDate` 以 ISO 日期字符串形式存储在 `ExtensionContext.globalState` 中。激活时调用 `globalState.setKeysForSync(['lastRecordedDate'])`，使其参与 VS Code 设置同步。
 - **不缓存数据**：面板每次打开或手动刷新都会重新请求 WakaTime API，MVP 不实现本地缓存。
 - **暂不同步腾讯文档**：MVP 明确不包含向腾讯文档推送数据，用户继续从项目列表手动复制数值。
 - **不做项目映射**：由于用户是一仓库一项目，直接使用 WakaTime 项目名。
 - **错误处理**：缺少配置或 API 失败时，在面板内以文字提示形式展示，并提供重试按钮。

 ## 测试决策

 - **聚合逻辑单元测试**：将原始 WakaTime 汇总数据转换为每日总时长和项目总时长的模块，应使用模拟的 WakaTime 响应进行单元测试。
 - **Webview 手动测试**：在 VS Code 中打开面板，切换 7/30/90 tab，验证 uPlot 图表和项目列表渲染正常。
 - **集成测试**：使用用户的 API Key，手动验证 7/30/90 三个时间范围都能从 WakaTime API 正常返回数据。
 - **设置同步测试**：验证在 A 机器设置的 `lastRecordedDate`，在开启 VS Code 设置同步的 B 机器上能同步过来。
 - **不测试 VS Code API 胶水层**：命令注册、Webview 创建、`postMessage` 等视为薄胶水层，由端到端手动测试覆盖。
 - **不测试 WakaTime HTTP 客户端**：实际 HTTP 请求视为简单适配器，失败路径和手动测试覆盖即可。

 ## 不在范围内

 - 自动同步到腾讯文档或其他表格工具。
 - 本地心跳采集（MVP 依赖 WakaTime）。
 - 编辑或手动补录时间。
 - 按文件或按语言的细分公司。
 - 自定义项目名映射或重命名。
 - WakaTime 响应缓存。
 - 通过 OAuth 认证 WakaTime（复用 `~/.wakatime.cfg` 中的 API Key）。
 - 排行榜、公开资料、团队功能。
 - 移动端或浏览器端支持。

 ## 补充说明

 - WakaTime 免费版控制台只能看最近 1 周历史，但已实测其 API 在免费账号下可返回至少 90 天汇总数据，本实现依赖该 API 行为。
 - 用户确认 WakaTime 从 Git 仓库名派生的项目名，可以直接对应到成本表中的项目。
 - 用户本机已有代理可以访问 `wakatime.com`，插件不内置代理。
 - 用户希望在 CodePulse 提供状态栏后隐藏 WakaTime 状态栏图标。CodePulse 不会修改 WakaTime 设置，隐藏操作由用户通过 WakaTime 自身偏好设置完成。
