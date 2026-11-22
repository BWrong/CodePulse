 # CodePulse 上下文

 ## 领域

 CodePulse 是一个编码时间追踪插件，帮助开发者追踪和抄录自己的编码时间。两个宿主实现同一套功能：
两个宿主各占仓库根的一个目录：VS Code 扩展（`vscode`）与 Orca 插件（`orca`）。不再有 `packages/` 这一层——Orca 的目录索引器只对根目录或 `plugin/` 这类单层目录生效，而两个包同级放根目录对谁都更好找。
两个包的版本号保持一致（`vscode/package.json`、`orca/package.json`、`orca/orca-plugin.json` 同号），发版时一起升。
仓库根的 `orca-catalog.json` 是给自己用的单插件目录：Orca 的收录索引器要求 `orca-plugin.json` 在根目录或单层目录里，多插件/子目录仓库必须靠根目录 catalog 的 `source.path` 指过去。每次发版先 `orca plugin release-entry ./orca`，把输出的 release 条目贴进 catalog（commit 与 contentHash 必须一致），再打 `-a` 注释标签。

 - **编码时长**：通过 WakaTime 插件采集的每日心跳数据，按项目和日期汇总。
 - **抄表辅助**：用户需要定期把各项目工时抄到外部成本表（如腾讯文档）。插件提供"记录完成"按钮来标记最后一次抄表的日期时间。
 - **未记录时长**：从 `lastRecordedDate` 到当前时间之间，尚未被抄表的编码时长。

 ## 关键决策

 ### Dashboard 样式与交互优化（#9 已完成）

 - 保持 `src/dashboard.ts` 内嵌 HTML/CSS/JS 架构。
 - 使用 VS Code CSS 变量（`--vscode-*`）适配深色/浅色主题。
 - 顶部统计卡片顺序：总时长、今天、每天、最活跃。
 - 「每天」= 总时长 / 有编码的天数（排除零活跃天，同 WakaTime 的 days_minus_holidays 口径），不是除以区间日历天数。
 - 「最活跃」展示编码时长最多的一天：上方显示该天时长，下方显示该天日期。
 - 趋势图使用 uPlot，自定义 tooltip，隐藏图例与轴名，平滑曲线。
 - 趋势图每日时长按「当天 ≥ 项目最小时长阈值的项目之和」计算，低于阈值的项目不纳入趋势线与 tooltip（与项目视图、未记录模块口径一致，阈值由 `codepulse.minProjectDurationMinutes` 控制，默认 10 分钟）。
 - 项目视图进度条使用 `var(--accent)` 填充，`var(--card-bg)` + 边框作为背景，确保主题可见性。

 ### Orca 插件（`orca`）

 - 功能与 VS Code 版对齐：状态栏今日时长、7/30/90/180/365 天趋势、项目分布、项目详情环形图、AI 统计、未记录模块（按 `showUnrecordedProjects` 开关，默认不显示）。
 - 与 VS Code 版的差异只来自宿主限制：状态栏只显示今日时长、不挂点击（Orca 没有「打开插件面板」的内置动作，`shell.openExternal` 也不对 worker 开放、还要求帧内手势），面板从右侧栏图标进入，网页链接由面板里的按钮打开；uPlot 内联进 `panel.html`（面板 CSP 没有 `'self'`）；WakaTime 请求只能在插件的 Node worker 里发（面板帧 `connect-src 'none'`）。
 - 顶部时间范围文案统一用天数：`7 天 / 30 天 / 90 天 / 180 天 / 365 天`，因为数据就是按天数截的（VS Code 版是 tab，Orca 版因为面板窄改成下拉，操作按钮也改成纯图标 + title 提示）。
 - 前端渲染逻辑与协议原样复用 VS Code 版：`panel.html` 里仍是 `window 'message'` + `switch(command)`，入口处一层 shim 把 `postMessage` 转成 `orca.plugin.request`。
 - 状态栏文案由 worker 每 5 分钟用 `statusBar.update` 推送；缺凭证时显示「未配置凭证」并在面板顶部给输入框。
 - 两个设置项走 `contributes.settings`（`minProjectDurationMinutes`、`showUnrecordedProjects`），由 worker 每次 `update` 消息带给面板——设置改了不用重装插件，但要重开面板才生效。
 - 详见 [ADR 0001](docs/adr/0001-orca-plugin-shape.md)。

 ### 未记录项目模块（#10 已完成）

 - **位置**：面板最底部，项目视图之后（项目列表占空间，放最后不挡主视图）。
 - **样式**：左侧"未记录总时长"摘要，右侧项目卡片网格（项目名、时长 · 占比、进度条）。
 - **数据范围**：基于当前页面已加载的 7/30/90 天数据，统计 `date >= lastRecordedDate 日期部分` 的天（记录日当天也算未记录，因为记录后用户可能继续编码）。
 - **占比基准**：以未记录期间总时长为 100%。
 - **排序**：按时长降序。
 - **记录完成按钮**：位于未记录模块内部（不在顶部 header），三个渲染分支都带该按钮；点击只回传 `recordedUpdated` 局部刷新，不重拉汇总数据。
 - **时间显示**：模块显示「上次记录时间」（记录完成的时刻）；「数据截止时间」（`lastRecordedDate` 日期部分的前一天，即已抄表数据实际截止日）以「未记录项目」标题旁的 info 图标 hover tooltip 展示，提示记录日当天数据尚未抄表。
 - **空状态**：
   - 若 `lastRecordedDate` 为空："尚未记录过，点击下方'记录完成'按钮开始"。
   - 若存在 `lastRecordedDate` 但无未记录时长："暂无未记录时长，上次记录时间为 …"。

 ### 项目详情功能（内嵌展开，#20 已完成）

 - **交互**：点击项目视图中的项目行任意位置，在该行下方内嵌展开详情区；同时只展开一个项目，再点当前项目或点其他项目即收起。移除原先点击项目名弹出的"总计 Xh Ym"popover。
 - **数据范围**：详情区数据跟随顶部全局 7/30/90 切换；切换范围或手动刷新时自动收起详情区，避免展示过期数据。
 - **摘要**：总时长、日均、活跃天数，从现有 `summary` 直接计算，零额外请求。日均 = 总时长 / 活跃天数（只除有该项目的天，不是区间总天数）。
 - **每日趋势**：复用 uPlot 绘制该项目每日时长，与主趋势图共享 tooltip 与 resize 逻辑，同样零额外请求。
 - **工具分布与 AI 代码占比**：两个环形图，分别展示编辑器分布（`details.editors`）与 AI/人工行数占比。占比只算**新增行数**（AI 新增 ÷（AI 新增 + 人工新增）），删除行不计入——一次批量删文件就会把比例翻过去。
 - **AI 统计**：总 token、模型成本、缓存命中率三项。
 - **数据获取**：摘要与每日趋势之外的内容在展开时调用 `Summaries?project=xxx`（该接口传 `project` 参数后返回的 `grand_total` 即该项目总时长与 AI 统计），按「项目:天数」做内存缓存，切换 7/30/90 不会串数据。
 - **为何不用 Stats 接口**：Stats 接口不支持 `project` 过滤，无法按项目取 AI 统计，故用 Summaries + `project` 参数。

 ### WakaTime 凭证迁移 OAuth（政策 2026-11-01 生效）

 - **背景**：WakaTime 从 2026-11-01 起 API Key 只允许官方插件上报心跳，直连读接口（summaries/durations/status_bar/data_dumps）必须改用 OAuth token。
 - **认证方式**：凭证统一放 `api_key` 查询参数，不再用 HTTP Basic Auth。WakaTime 明确说明 OAuth token 可以填在 `api_key` 参数里，且过渡期旧 API Key 仍能通过同一路径工作，所以只需一套代码路径。
 - **凭证解析顺序**：SecretStorage（命令 `CodePulse: 设置 WakaTime Token` 写入）→ `~/.wakatime.cfg` 的 `api_key`。
 - **为何用 SecretStorage 而不放设置项**：token 是长期个人凭证；`settings.json` 是明文且会被 Settings Sync 同步，且 VS Code 无法按单个键排除同步。SecretStorage 存系统钥匙串，不跨机同步，代价是换机器需重填一次。
 - **为何保留 `~/.wakatime.cfg` 回退**：过渡期用户不填 token 也能用，不强制迁移。
 - **Orca 版对应物**：没有命令面板，凭证入口是面板顶部的「凭证」按钮（写入 `orca.secrets`），
   同样回退读 `~/.wakatime.cfg`；但 API Key 现在读不了数据（实测 401/403），实际必须填 OAuth token。

 ## 待确认

 - 未记录模块中是否需要显示"未记录期间起始日期"？
 - 项目列表是否需要截断或折叠大量项目？

 ## 相关链接

 - 产品需求文档：[docs/spec.md](docs/spec.md)
 - Wayfinding Map：[#9](https://github.com/BWrong/CodePulse/issues/9)
