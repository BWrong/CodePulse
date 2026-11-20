// CodePulse 的 Orca worker：WakaTime 请求都在这里发（面板帧没有网络），
// 顺便每 5 分钟把今日编码时长推到状态栏。
import type { OrcaWorkerApi } from 'orca/worker'
import type { PanelRequestContext } from 'orca/worker'
import type {
  CodingSummary,
  ProjectDayDistribution,
  ProjectDetails,
  TimeCollector,
} from './models'
import { createWakaTimeCollector } from './collectors/wakatimeCollector'
import type { PanelMessage, RequestResult } from './protocol'
import { formatDate } from './utils/date'

const TOKEN_KEY = 'wakatimeToken'
const RECORDED_KEY = 'lastRecordedDate'
/** 汇总缓存有效期：区间相对今天，过期后重拉。 */
const SUMMARY_CACHE_TTL_MS = 60_000
const STATUS_BAR_ID = 'today'
const STATUS_REFRESH_MS = 5 * 60 * 1000
const DEFAULT_MIN_PROJECT_MINUTES = 10

type RangeDays = 7 | 30 | 90 | 180 | 365

interface PanelState {
  days: RangeDays
  projectDate: Date
  isLoading: boolean
  isLoadingProject: boolean
  summaries: Map<RangeDays, { at: number; summary: CodingSummary }>
  distributions: Map<string, ProjectDayDistribution>
  details: Map<string, ProjectDetails>
}

// shortcut: 面板关闭时不清理，Map 里会留下空条目，条目量级等于面板开启次数，可忽略。
const panels = new Map<string, PanelState>()

function stateFor(context: PanelRequestContext): PanelState {
  let state = panels.get(context.panel.id)
  if (!state) {
    state = {
      days: 7,
      projectDate: new Date(),
      isLoading: false,
      isLoadingProject: false,
      summaries: new Map(),
      distributions: new Map(),
      details: new Map(),
    }
    panels.set(context.panel.id, state)
  }
  return state
}

async function collectorFor(orca: OrcaWorkerApi): Promise<TimeCollector | undefined> {
  const stored = await orca.secrets.get(TOKEN_KEY)
  return createWakaTimeCollector(typeof stored === 'string' ? stored : undefined)
}

const NO_CREDENTIAL: PanelMessage = {
  command: 'error',
  message:
    '未找到 WakaTime 凭证。点面板上的「凭证」填入 OAuth Token（wakatime.com/oauth）。',
}

async function panelSettings(
  orca: OrcaWorkerApi
): Promise<{ minProjectSeconds: number; showUnrecorded: boolean }> {
  try {
    // 1.4.265 的 mockHost 返回裸键值表，而 d.ts 写的是 `{ settings }`：两种都认。
    const raw = (await orca.settings.get()) as Record<string, unknown>
    const settings = (raw.settings ?? raw) as Record<string, unknown>
    const minutes = Number(settings.minProjectDurationMinutes)
    const value = Number.isFinite(minutes) ? minutes : DEFAULT_MIN_PROJECT_MINUTES
    return {
      minProjectSeconds: Math.max(0, Math.round(value * 60)),
      showUnrecorded: settings.showUnrecordedProjects === true,
    }
  } catch {
    return { minProjectSeconds: DEFAULT_MIN_PROJECT_MINUTES * 60, showUnrecorded: false }
  }
}

function dateRange(days: RangeDays): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

async function loadSummary(
  orca: OrcaWorkerApi,
  state: PanelState,
  force = false
): Promise<PanelMessage[]> {
  if (state.isLoading) {
    return []
  }
  const cached = force ? undefined : state.summaries.get(state.days)
  if (cached && Date.now() - cached.at < SUMMARY_CACHE_TTL_MS) {
    return [await updateMessage(orca, state, cached.summary)]
  }

  const days = state.days
  state.isLoading = true
  const messages: PanelMessage[] = [{ command: 'loading' }]
  try {
    const collector = await collectorFor(orca)
    if (!collector) {
      return [...messages, NO_CREDENTIAL, { command: 'tokenRequired' }]
    }
    const { start, end } = dateRange(days)
    const summary = await collector.getSummaries(start, end)
    state.summaries.set(days, { at: Date.now(), summary })
    messages.push(await updateMessage(orca, state, summary))
  } catch (error) {
    messages.push({ command: 'error', message: errorText(error) })
  } finally {
    state.isLoading = false
  }
  return messages
}

async function updateMessage(
  orca: OrcaWorkerApi,
  state: PanelState,
  summary: CodingSummary
): Promise<PanelMessage> {
  // Orca 只接受严格的 JSON 值：undefined 属性的键会让整个响应被拒（non-JSON value）。
  const message: PanelMessage = {
    command: 'update',
    days: state.days,
    summary,
    ...(await panelSettings(orca)),
  }
  const recorded = await lastRecordedDate(orca)
  if (recorded !== undefined) {
    message.lastRecordedDate = recorded
  }
  return message
}

async function loadDistribution(
  orca: OrcaWorkerApi,
  state: PanelState
): Promise<PanelMessage[]> {
  if (state.isLoadingProject) {
    return []
  }
  const key = formatDate(state.projectDate)
  const cached = state.distributions.get(key)
  if (cached) {
    return [{ command: 'projectDistribution', distribution: cached, projectDay: key, cached: true }]
  }

  state.isLoadingProject = true
  const messages: PanelMessage[] = [{ command: 'projectDistributionLoading', projectDay: key }]
  try {
    const collector = await collectorFor(orca)
    if (!collector) {
      return [...messages, { command: 'projectDistributionError', projectDay: key, message: NO_CREDENTIAL.message }]
    }
    const distribution = await collector.getDistributionByDate(state.projectDate)
    state.distributions.set(key, distribution)
    messages.push({ command: 'projectDistribution', distribution, projectDay: key, cached: false })
  } catch (error) {
    messages.push({ command: 'projectDistributionError', projectDay: key, message: errorText(error) })
  } finally {
    state.isLoadingProject = false
  }
  return messages
}

async function loadDetails(
  orca: OrcaWorkerApi,
  state: PanelState,
  projectName: string
): Promise<PanelMessage[]> {
  const cacheKey = `${projectName}:${state.days}`
  const cached = state.details.get(cacheKey)
  const messages: PanelMessage[] = [{ command: 'projectDetailsLoading', projectName }]
  if (cached) {
    return [{ command: 'projectDetails', projectName, details: cached }]
  }
  try {
    const collector = await collectorFor(orca)
    if (!collector) {
      return [...messages, { command: 'projectDetailsError', projectName, message: NO_CREDENTIAL.message }]
    }
    const { start, end } = dateRange(state.days)
    const details = await collector.getProjectDetails(projectName, start, end)
    state.details.set(cacheKey, details)
    messages.push({ command: 'projectDetails', projectName, details })
  } catch (error) {
    messages.push({ command: 'projectDetailsError', projectName, message: errorText(error) })
  }
  return messages
}

async function lastRecordedDate(orca: OrcaWorkerApi): Promise<string | undefined> {
  const value = await orca.storage.get(RECORDED_KEY)
  return typeof value === 'string' ? value : undefined
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${mins}m`
}

async function updateStatusBar(orca: OrcaWorkerApi): Promise<void> {
  try {
    const collector = await collectorFor(orca)
    if (!collector) {
      await orca.host.call('statusBar.update', {
        id: STATUS_BAR_ID,
        text: '未配置凭证',
        tone: 'warning',
        tooltip: 'CodePulse：未找到 WakaTime 凭证，打开 CodePulse 面板填写',
      })
      return
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const summary = await collector.getSummaries(today, today)
    const seconds = summary.days[0]?.totalSeconds ?? 0
    await orca.host.call('statusBar.update', {
      id: STATUS_BAR_ID,
      text: formatDuration(seconds),
      tone: 'neutral',
      tooltip: 'CodePulse：今日编码时长，从右侧栏 CodePulse 查看详情',
    })
  } catch (error) {
    await orca.host.call('statusBar.update', {
      id: STATUS_BAR_ID,
      text: 'CodePulse',
      tone: 'danger',
      tooltip: `CodePulse：读取今日时长失败（${errorText(error)}）`,
    })
  }
}

export default function activate(orca: OrcaWorkerApi): void {
  orca.panels.handle('ready', async (_input, context) => {
    const state = stateFor(context)
    return {
      messages: [...(await loadSummary(orca, state)), ...(await loadDistribution(orca, state))],
    } satisfies RequestResult
  })

  orca.panels.handle('refresh', async (_input, context) => {
    const state = stateFor(context)
    state.summaries.clear()
    state.distributions.clear()
    return { messages: await loadSummary(orca, state, true) } satisfies RequestResult
  })

  orca.panels.handle('changeRange', async ({ days }, context) => {
    const state = stateFor(context)
    state.days = days as RangeDays
    return { messages: await loadSummary(orca, state) } satisfies RequestResult
  })

  orca.panels.handle('changeProjectDay', async ({ projectDay }, context) => {
    const state = stateFor(context)
    state.projectDate = new Date(projectDay)
    return { messages: await loadDistribution(orca, state) } satisfies RequestResult
  })

  orca.panels.handle('clickProject', async ({ projectName }, context) => {
    const state = stateFor(context)
    return { messages: await loadDetails(orca, state, projectName) } satisfies RequestResult
  })

  orca.panels.handle('markRecorded', async (_input, context) => {
    stateFor(context)
    const now = new Date()
    const stamp = `${formatDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    await orca.storage.set(RECORDED_KEY, stamp)
    return { messages: [{ command: 'recordedUpdated', lastRecordedDate: stamp }] } satisfies RequestResult
  })

  orca.panels.handle('setToken', async ({ token }, context) => {
    const state = stateFor(context)
    const trimmed = token.trim()
    orca.log(`setToken: ${trimmed ? `${trimmed.length} chars` : 'cleared'}`)
    if (trimmed) {
      await orca.secrets.set(TOKEN_KEY, trimmed)
    } else {
      await orca.secrets.delete(TOKEN_KEY)
    }
    state.summaries.clear()
    state.distributions.clear()
    state.details.clear()
    updateStatusBar(orca)
    return { messages: await loadSummary(orca, state, true) } satisfies RequestResult
  })

  updateStatusBar(orca)
  statusTimer = setInterval(() => updateStatusBar(orca), STATUS_REFRESH_MS)
}

let statusTimer: ReturnType<typeof setInterval> | undefined

export function deactivate(): void {
  if (statusTimer) {
    clearInterval(statusTimer)
    statusTimer = undefined
  }
}
