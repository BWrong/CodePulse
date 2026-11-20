export interface WakaTimeGrandTotal {
  hours: number;
  minutes: number;
  total_seconds: number;
  ai_additions?: number;
  ai_deletions?: number;
  human_additions?: number;
  human_deletions?: number;
  ai_input_tokens?: number;
  ai_cached_input_tokens?: number;
  ai_output_tokens?: number;
  ai_model_total_cost?: number;
  ai_sessions?: number;
}

 export interface WakaTimeProjectEntry {
   name: string;
   total_seconds: number;
   ai_additions?: number;
   ai_deletions?: number;
   ai_input_tokens?: number;
   ai_output_tokens?: number;
 }

export interface WakaTimeDimensionEntry {
  name: string;
  total_seconds: number;
  percent?: number;
}

export interface WakaTimeDaySummary {
  grand_total: WakaTimeGrandTotal;
  projects: WakaTimeProjectEntry[];
  editors?: WakaTimeDimensionEntry[];
  categories?: WakaTimeDimensionEntry[];
  range: {
    date: string;
  };
}

 export interface WakaTimeSummariesResponse {
   data: WakaTimeDaySummary[];
 }

export interface WakaTimeDuration {
  project: string;
  branch?: string;
  duration: number;
  time?: number;
}

export interface WakaTimeDurationsResponse {
  data: WakaTimeDuration[];
  start: string;
  end: string;
  timezone: string;
}

/** status_bar/today 的 data 与 Summaries 单日同形，只读服务端缓存。 */
export interface WakaTimeStatusBarResponse {
  cached_at: string;
  data: WakaTimeDaySummary;
  has_team_features: boolean;
}

export type WakaTimeDataDumpType = 'daily' | 'heartbeats';

export interface WakaTimeDataDump {
  id: string;
  status: string;
  percent_complete: number;
  download_url: string | null;
  type: WakaTimeDataDumpType;
  is_processing: boolean;
  is_stuck: boolean;
  has_failed: boolean;
  expires: string;
  created_at: string;
}

export interface WakaTimeDataDumpsResponse {
  data: WakaTimeDataDump[];
}
