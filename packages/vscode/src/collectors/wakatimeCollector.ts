import {
  CodingSummary,
  ProjectDayDistribution,
  ProjectDetails,
  TimeCollector,
} from '../models';
import {
  fetchWakaTimeDurations,
  fetchWakaTimeSummaries,
} from './wakatimeApiClient';
 import { aggregateSummaries, aggregateProjectDetails } from './wakatimeAggregator';
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

  async getProjectDetails(
    project: string,
    start: Date,
    end: Date
  ): Promise<ProjectDetails> {
    const response = await fetchWakaTimeSummaries(this.apiKey, start, end, project);
    return aggregateProjectDetails(response, project);
  }
 }

 export function createWakaTimeCollector(): TimeCollector | undefined {
   const apiKey = readWakaTimeApiKey();
   if (!apiKey) {
     return undefined;
   }
   return new WakaTimeCollector(apiKey);
 }
