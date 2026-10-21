 # CodePulse
 
 在 VS Code 内查看按项目汇总的编码时间，辅助项目成本核算。
 
 ## 功能
 
 - 查看最近 7 / 30 / 90 天、半年、1 年的编码数据
 - 按项目汇总总时长与平均每天时长
 - 每日编码时长柱状图
 - 项目视图与进度条
 - 抄表辅助：标记已记录日期，支持 VS Code 设置同步
 - 状态栏显示今日编码时长
 
 ## 依赖
 
 本插件依赖 [WakaTime](https://wakatime.com/) 采集编码心跳。WakaTime 从 2026-11-01 起不再允许用 API Key 直连读接口，需改用 OAuth token。

## 凭证

按以下顺序解析，命中即用：

1. 命令 `CodePulse: 设置 WakaTime Token` 保存的值（系统钥匙串，不进 Settings Sync）
2. `~/.wakatime.cfg` 中的 `api_key`（复用 WakaTime 官方插件登录态，方便过渡期）

OAuth token 在 [wakatime.com/oauth](https://wakatime.com/oauth) 获取。
 
 ## 配置
 
 | 配置项 | 类型 | 默认值 | 说明 |
 |--------|------|--------|------|
| `codepulse.minProjectDurationMinutes` | number | `10` | 忽略编码时长低于该值（分钟）的项目统计。设为 `0` 表示不过滤。 |

在 VS Code `settings.json` 中按需调整：

```json
{
   "codepulse.minProjectDurationMinutes": 10
}
 ```
 
 ## 需求文档
 
 详见 [docs/spec.md](https://github.com/BWrong/CodePulse/blob/main/docs/spec.md)。
