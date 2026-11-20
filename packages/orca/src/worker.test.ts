// `orca plugin test ./packages/orca` 跑这个文件：worker 的请求处理器 + 状态栏推送。
import { afterEach, assert, beforeEach, mockHost, mountWorker, test } from 'orca/testing'
import type { TestWorker } from 'orca/testing'
import * as main from './worker'

const PANEL = { panel: 'dashboard' }
// 让 ~/.wakatime.cfg 的回退读不到任何东西，测试结果不随开发机环境变。
const EMPTY_HOME = '/codepulse-plugin-test-home'

let worker: TestWorker | undefined
let realHome: string | undefined
let realFetch: typeof fetch

beforeEach(() => {
  realHome = process.env.HOME
  realFetch = globalThis.fetch
  process.env.HOME = EMPTY_HOME
  globalThis.fetch = (() => Promise.reject(new Error('测试里不发真实请求'))) as typeof fetch
})

afterEach(async () => {
  await worker?.deactivate()
  worker = undefined
  process.env.HOME = realHome
  globalThis.fetch = realFetch
})

test('没有凭证时让面板要求填写 token，并更新状态栏提示', async () => {
  const host = mockHost()
  worker = await mountWorker(main, { host })
  await new Promise(resolve => setTimeout(resolve, 0))

  const { messages } = await worker.request('ready', undefined, PANEL)
  assert.deepEqual(
    messages.map(message => message.command),
    ['loading', 'error', 'tokenRequired', 'projectDistributionLoading', 'projectDistributionError']
  )
  const statusCall = host.callsOf('statusBar.update')[0] as { text: string; tone: string }
  assert.equal(statusCall.text, '未配置凭证')
  assert.equal(statusCall.tone, 'warning')
})

test('setToken 存进 secrets，随后拉取失败会给出错误消息', async () => {
  const host = mockHost()
  worker = await mountWorker(main, { host })

  const saved = await worker.request('setToken', { token: '  abc-123  ' }, PANEL)
  assert.equal(host.data().secrets.wakatimeToken, 'abc-123')
  assert.equal(saved.messages[0].command, 'loading')

  const { messages } = await worker.request('refresh', undefined, PANEL)
  assert.equal(messages[0].command, 'loading')
  assert.match(messages[1].message, /无法连接到 WakaTime/)
})

test('成功响应里不带 undefined 属性的键，Orca 只接受严格 JSON', async () => {
  const host = mockHost()
  worker = await mountWorker(main, { host })
  await worker.request('setToken', { token: 'abc-123' }, PANEL)
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )) as typeof fetch

  // storage 里没有 lastRecordedDate 时，它的值是 undefined：JSON 里不存在这个键，Orca 会拒收整个响应。
  const result = await worker.request('ready', undefined, PANEL)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('面板设置跟着 update 消息下发（最小项目时长、未记录项目开关）', async () => {
  const host = mockHost({
    settings: { minProjectDurationMinutes: 2, showUnrecordedProjects: true },
  })
  worker = await mountWorker(main, { host })
  await worker.request('setToken', { token: 'abc-123' }, PANEL)
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )) as typeof fetch

  const { messages } = await worker.request('ready', undefined, PANEL)
  const update = messages.find(message => message.command === 'update')
  assert.equal(update?.minProjectSeconds, 120)
  assert.equal(update?.showUnrecorded, true)
})

test('markRecorded 把时间戳写进 storage 并回传面板', async () => {
  const host = mockHost({ storage: { lastRecordedDate: '2026-01-01 08:00:00' } })
  worker = await mountWorker(main, { host })

  const { messages } = await worker.request('markRecorded', undefined, PANEL)
  const stamp = messages[0].lastRecordedDate as string
  assert.equal(messages[0].command, 'recordedUpdated')
  assert.match(stamp, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(host.data().storage.lastRecordedDate, stamp)
})

test('切换范围和项目日期只动自己那个面板的状态', async () => {
  const host = mockHost()
  worker = await mountWorker(main, { host })

  const ranged = await worker.request('changeRange', { days: 365 }, PANEL)
  assert.equal(ranged.messages[0].command, 'loading')
  const other = await worker.request('changeRange', { days: 30 }, { panel: 'dashboard-secondary' })
  assert.equal(other.messages[0].command, 'loading')

  const distribution = await worker.request('changeProjectDay', { projectDay: '2026-01-02' }, PANEL)
  assert.deepEqual(
    distribution.messages.map(message => message.projectDay),
    ['2026-01-02', '2026-01-02']
  )
})
