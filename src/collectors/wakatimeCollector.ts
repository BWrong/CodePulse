 import { CodingSummary, TimeCollector } from '../models';
 import { fetchWakaTimeSummaries } from './wakatimeApiClient';
 import { aggregateSummaries } from './wakatimeAggregator';
 import { readWakaTimeApiKey } from './wakatimeConfigReader';

 export class WakaTimeCollector implements TimeCollector {
   constructor(private readonly apiKey: string) {}

   async getSummaries(start: Date, end: Date): Promise<CodingSummary> {
     const response = await fetchWakaTimeSummaries(this.apiKey, start, end);
     return aggregateSummaries(response, start, end);
   }
 }

 export function createWakaTimeCollector(): TimeCollector | undefined {
   const apiKey = readWakaTimeApiKey();
   if (!apiKey) {
     return undefined;
   }
   return new WakaTimeCollector(apiKey);
 }
