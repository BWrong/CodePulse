 # CodePulse
 
 在 VS Code 内查看按项目汇总的编码时间，辅助项目成本核算。
 
 ## 功能
 
 - 查看最近 7 / 30 / 90 天的编码数据
 - 按项目汇总总时长与平均每天时长
 - 每日编码时长柱状图
 - 项目视图与进度条
 - 抄表辅助：标记已记录日期，支持 VS Code 设置同步
 - 状态栏显示今日编码时长
 
 ## 依赖
 
 本插件依赖 [WakaTime](https://wakatime.com/) VS Code 插件采集编码心跳，并复用其 `~/.wakatime.cfg` 中的 API Key。
 
 ## 配置
 
 | 配置项 | 类型 | 默认值 | 说明 |
 |--------|------|--------|------|
 | `codepulse.minProjectDurationMinutes` | number | `5` | 忽略编码时长低于该值（分钟）的项目统计。设为 `0` 表示不过滤。 |
 
 在 VS Code `settings.json` 中按需调整：
 
 ```json
 {
   "codepulse.minProjectDurationMinutes": 3
 }
 ```
 
 ## 需求文档
 
 详见 [docs/spec.md](./docs/spec.md)。
