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
 
 ## 需求文档
 
 详见 [docs/spec.md](./docs/spec.md)。
