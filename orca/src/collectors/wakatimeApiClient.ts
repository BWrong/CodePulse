import {
  WakaTimeDataDump,
  WakaTimeDataDumpType,
  WakaTimeDataDumpsResponse,
  WakaTimeDurationsResponse,
  WakaTimeStatusBarResponse,
  WakaTimeSummariesResponse,
} from './wakatimeTypes';
import { formatDate } from '../utils/date';

function friendlyErrorMessage(statusCode: number | undefined): string {
  switch (statusCode) {
    case 401:
      return 'WakaTime 凭证无效，点面板上的「凭证」重新填写 OAuth Token（wakatime.com/oauth）。';
    case 402:
      return '该功能需要 WakaTime 付费账号。';
    case 403:
      return '没有权限访问 WakaTime 数据，请确认凭证有效且账号已激活。';
    case 404:
      return '未找到 WakaTime 用户数据。';
    case 429:
      return 'WakaTime API 请求过于频繁，请稍后再试。';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'WakaTime 服务暂时不可用，请稍后再试。';
    default:
      return statusCode
        ? `WakaTime API 返回错误 ${statusCode}，请检查网络或代理。`
        : '无法连接到 WakaTime，请检查网络或代理。';
  }
}

/**
 * 凭证走 api_key 参数：WakaTime 明确说明 OAuth token 可放在这里，
 * 2026-11-01 起 API Key 不再允许直连读接口，只能用于插件上报。
 */
export function withCredential(url: string, credential: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(credential)}`;
}

/**
 * Orca 版用全局 fetch（worker 是 Node 进程）：面板帧没有网络，WakaTime 请求只能在这里发。
 * 语义与 VS Code 版的 https 版本一致：非 2xx 视为失败，15 秒超时。
 */
async function requestJson<T>(
  credential: string,
  url: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const authUrl = withCredential(url, credential);
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(authUrl, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('请求 WakaTime 超时，请检查网络或代理。');
    }
    const reason = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : '';
    throw new Error(`无法连接到 WakaTime，请检查网络或代理。(${reason}${cause})`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(friendlyErrorMessage(response.status));
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new Error(`解析 WakaTime 响应失败：${error}`);
  }
}

export function fetchWakaTimeSummaries(
  apiKey: string,
  start: Date,
  end: Date,
  project?: string
): Promise<WakaTimeSummariesResponse> {
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  const projectParam = project ? `&project=${encodeURIComponent(project)}` : '';
  const url = `https://wakatime.com/api/v1/users/current/summaries?start=${startStr}&end=${endStr}${projectParam}`;
  return requestJson<WakaTimeSummariesResponse>(apiKey, url);
}

export function fetchWakaTimeDurations(
  apiKey: string,
  date: Date
): Promise<WakaTimeDurationsResponse> {
  const dateStr = formatDate(date);
  const url = `https://wakatime.com/api/v1/users/current/durations?date=${dateStr}`;
  return requestJson<WakaTimeDurationsResponse>(apiKey, url);
}

/**
 * 今天的编码活动。与 Summaries 的 "Today" 等价，但只读服务端缓存，
 * 适合状态栏这种高频轮询的场景。
 */
export function fetchWakaTimeStatusBarToday(
  apiKey: string
): Promise<WakaTimeStatusBarResponse> {
  return requestJson<WakaTimeStatusBarResponse>(
    apiKey,
    'https://wakatime.com/api/v1/users/current/status_bar/today'
  );
}

export function fetchWakaTimeDataDumps(apiKey: string): Promise<WakaTimeDataDumpsResponse> {
  return requestJson<WakaTimeDataDumpsResponse>(
    apiKey,
    'https://wakatime.com/api/v1/users/current/data_dumps'
  );
}

/** 创建一个后台导出任务；email_when_finished 关掉，导出结果由插件自己轮询。 */
export function createWakaTimeDataDump(
  apiKey: string,
  type: WakaTimeDataDumpType
): Promise<{ data: WakaTimeDataDump }> {
  return requestJson<{ data: WakaTimeDataDump }>(
    apiKey,
    'https://wakatime.com/api/v1/users/current/data_dumps',
    { method: 'POST', body: { type, email_when_finished: false } }
  );
}
