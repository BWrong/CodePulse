import {
  CodingSummary,
  ProjectAllTime,
  ProjectDayDistribution,
  TimeCollector,
} from '../models';
import {
  fetchWakaTimeAllTime,
  fetchWakaTimeDurations,
  fetchWakaTimeSummaries,
} from './wakatimeApiClient';
 import { aggregateSummaries } from './wakatimeAggregator';
import { aggregateDurations } from './durationsAggregator';
 import { readWakaTimeApiKey } from './wakatimeConfigReader';

 export class WakaTimeCollector implements TimeCollector {
   constructor(private readonly apiKey: string) {}

   async getSummaries(start: Date, end: Date): Promise<CodingSummary> {
     const response = await fetchWakaTimeSummaries(this.apiKey, start, end);
     return aggregateSummaries(response, start, end);
   }

  async getDistributionByDate(date: Date): Promise<ProjectDayDistribution> {
    const response = await fetchWakaTimeDurations(this.apiKey, date);
    return aggregateDurations(response, date);
  }

  async getProjectAllTime(project: string): Promise<ProjectAllTime> {
    const response = await fetchWakaTimeAllTime(this.apiKey, project);
    return {
      project,
      totalSeconds: response.data.total_seconds,
      dailyAverage: response.data.daily_average,
    };
  }
 }

 export function createWakaTimeCollector(): TimeCollector | undefined {
   const apiKey = readWakaTimeApiKey();
   if (!apiKey) {
     return undefined;
   }
   return new WakaTimeCollector(apiKey);
 }
