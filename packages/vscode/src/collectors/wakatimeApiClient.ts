import * as https from 'https';
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
      return 'WakaTime API Key 无效，请检查 ~/.wakatime.cfg 中的 api_key。';
    case 402:
      return '该功能需要 WakaTime 付费账号。';
    case 403:
      return '没有权限访问 WakaTime 数据，请确认 API Key 已激活。';
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

function requestJson<T>(
  apiKey: string,
  url: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    let timedOut = false;
    const req = https.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            reject(new Error(friendlyErrorMessage(res.statusCode)));
            return;
          }
          try {
            resolve(JSON.parse(data) as T);
          } catch (error) {
            reject(new Error(`解析 WakaTime 响应失败：${error}`));
          }
        });
      }
    );

    req.on('error', error => {
      reject(
        timedOut
          ? new Error('请求 WakaTime 超时，请检查网络或代理。')
          : new Error(`无法连接到 WakaTime，请检查网络或代理。(${error.message})`)
      );
    });

    req.setTimeout(15000, () => {
      timedOut = true;
      req.destroy();
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
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
