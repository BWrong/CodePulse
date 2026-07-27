 export interface DailySummary {
   date: string;
   totalSeconds: number;
   projects: { name: string; totalSeconds: number }[];
 }

 export interface ProjectSummary {
   name: string;
   totalSeconds: number;
   percent: number;
 }

 export interface CodingSummary {
   startDate: string;
   endDate: string;
   totalSeconds: number;
   dailyAverageSeconds: number;
   days: DailySummary[];
   projects: ProjectSummary[];
 }

 export interface TimeCollector {
   getSummaries(start: Date, end: Date): Promise<CodingSummary>;
 }
