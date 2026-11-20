export interface ProjectSession {
  start: string;
  end: string;
}

export interface ProjectHourBucket {
  hour: number;
  coveredSeconds: number;
  sessions: ProjectSession[];
}

export interface ProjectDistribution {
  name: string;
  totalSeconds: number;
  percent: number;
  buckets: ProjectHourBucket[];
}

export interface ProjectDayDistribution {
  date: string;
  totalSeconds: number;
  projects: ProjectDistribution[];
}

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

export interface ProjectAiStats {
   aiTotalTokens: number;
   aiModelCost: number;
   aiCacheHitRate: number;
   aiLineRatio: number;
   aiLines: number;
   humanLines: number;
   aiSessions: number;
 }

 export interface ProjectDimensionItem {
   name: string;
   totalSeconds: number;
   percent: number;
 }

 export interface ProjectDetails {
   project: string;
   totalSeconds: number;
   ai: ProjectAiStats;
   editors: ProjectDimensionItem[];
   categories: ProjectDimensionItem[];
 }

 export interface TimeCollector {
    getSummaries(start: Date, end: Date): Promise<CodingSummary>;
    getDistributionByDate(date: Date): Promise<ProjectDayDistribution>;
    getProjectDetails(project: string, start: Date, end: Date): Promise<ProjectDetails>;
  }
