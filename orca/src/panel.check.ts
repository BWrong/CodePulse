// `orca plugin check ./orca` 每个场景渲染一次面板（截图里能直接看到面板真实样子）。
// 没有凭证和带了凭证两种情况，覆盖错误态与首屏骨架。
import { defineCheck } from 'orca/testing'

export default defineCheck({
  'no-credential': {},
  'with-token': { secrets: { wakatimeToken: 'test-token' }, settings: { minProjectDurationMinutes: 10 } }
})
