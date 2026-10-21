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
  constructor(private readonly credential: string) {}

  async getSummaries(start: Date, end: Date): Promise<CodingSummary> {
    const response = await fetchWakaTimeSummaries(this.credential, start, end);
    return aggregateSummaries(response, start, end);
  }

  async getDistributionByDate(date: Date): Promise<ProjectDayDistribution> {
    const response = await fetchWakaTimeDurations(this.credential, date);
    return aggregateDurations(response, date);
  }

  async getProjectDetails(
    project: string,
    start: Date,
    end: Date
  ): Promise<ProjectDetails> {
    const response = await fetchWakaTimeSummaries(this.credential, start, end, project);
    return aggregateProjectDetails(response, project);
  }
}

/** 优先用命令保存的 OAuth token，其次回退到 wakatime.cfg 的 api_key。 */
export function createWakaTimeCollector(token?: string): TimeCollector | undefined {
  const credential = token?.trim() || readWakaTimeApiKey();
  if (!credential) {
    return undefined;
  }
  return new WakaTimeCollector(credential);
}
