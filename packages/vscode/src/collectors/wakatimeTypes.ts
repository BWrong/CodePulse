 export interface WakaTimeGrandTotal {
   hours: number;
   minutes: number;
   total_seconds: number;
 }

 export interface WakaTimeProjectEntry {
   name: string;
   total_seconds: number;
 }

 export interface WakaTimeDaySummary {
   grand_total: WakaTimeGrandTotal;
   projects: WakaTimeProjectEntry[];
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

export interface WakaTimeAllTimeData {
  total_seconds: number;
  daily_average: number;
  is_up_to_date: boolean;
}

export interface WakaTimeAllTimeResponse {
  data: WakaTimeAllTimeData;
}
