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
