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
