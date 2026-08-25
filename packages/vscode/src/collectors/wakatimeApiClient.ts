 import * as https from 'https';
 import {
  WakaTimeAllTimeResponse,
  WakaTimeDurationsResponse,
  WakaTimeSummariesResponse,
} from './wakatimeTypes';
 import { formatDate } from '../utils/date';

 function friendlyErrorMessage(statusCode: number | undefined): string {
   switch (statusCode) {
     case 401:
       return 'WakaTime API Key 无效，请检查 ~/.wakatime.cfg 中的 api_key。';
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

 export function fetchWakaTimeSummaries(
   apiKey: string,
   start: Date,
   end: Date
 ): Promise<WakaTimeSummariesResponse> {
   const startStr = formatDate(start);
   const endStr = formatDate(end);
   const url = `https://wakatime.com/api/v1/users/current/summaries?start=${startStr}&end=${endStr}`;
   const auth = Buffer.from(`${apiKey}:`).toString('base64');

   return new Promise((resolve, reject) => {
     const req = https
       .get(
         url,
         {
           headers: {
             Authorization: `Basic ${auth}`,
             Accept: 'application/json',
           },
         },
         res => {
           let data = '';
           res.on('data', chunk => {
             data += chunk;
           });
           res.on('end', () => {
             if (res.statusCode === 200) {
               try {
                 resolve(JSON.parse(data));
               } catch (error) {
                 reject(new Error(`解析 WakaTime 响应失败：${error}`));
               }
             } else {
               reject(new Error(friendlyErrorMessage(res.statusCode)));
             }
           });
         }
       )
       .on('error', error => {
         reject(new Error(`无法连接到 WakaTime，请检查网络或代理。(${error.message})`));
       });

     req.setTimeout(15000, () => {
       req.destroy(new Error('请求 WakaTime 超时，请检查网络或代理。'));
     });
   });
 }


export function fetchWakaTimeDurations(
  apiKey: string,
  date: Date
): Promise<WakaTimeDurationsResponse> {
  const dateStr = formatDate(date);
  const url = `https://wakatime.com/api/v1/users/current/durations?date=${dateStr}`;
  const auth = Buffer.from(`${apiKey}:`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https
      .get(
        url,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        },
        res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (error) {
                reject(new Error(`解析 WakaTime 响应失败：${error}`));
              }
            } else {
              reject(new Error(friendlyErrorMessage(res.statusCode)));
            }
          });
        }
      )
      .on('error', error => {
        reject(new Error(`无法连接到 WakaTime，请检查网络或代理。(${error.message})`));
      });

    req.setTimeout(15000, () => {
      req.destroy(new Error('请求 WakaTime 超时，请检查网络或代理。'));
    });
  });
}


export function fetchWakaTimeAllTime(
  apiKey: string,
  project?: string
): Promise<WakaTimeAllTimeResponse> {
  const base = 'https://wakatime.com/api/v1/users/current/all_time_since_today';
  const url = project ? `${base}?project=${encodeURIComponent(project)}` : base;
  const auth = Buffer.from(`${apiKey}:`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https
      .get(
        url,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        },
        res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (error) {
                reject(new Error(`解析 WakaTime 响应失败：${error}`));
              }
            } else {
              reject(new Error(friendlyErrorMessage(res.statusCode)));
            }
          });
        }
      )
      .on('error', error => {
        reject(new Error(`无法连接到 WakaTime，请检查网络或代理。(${error.message})`));
      });

    req.setTimeout(15000, () => {
      req.destroy(new Error('请求 WakaTime 超时，请检查网络或代理。'));
    });
  });
}
