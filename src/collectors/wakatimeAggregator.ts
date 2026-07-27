 import { CodingSummary, DailySummary, ProjectSummary } from '../models';
 import { WakaTimeSummariesResponse } from './wakatimeTypes';

 function formatDate(date: Date): string {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
 }

 function daysBetweenInclusive(start: Date, end: Date): number {
   const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
   const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
   const diffMs = endMidnight.getTime() - startMidnight.getTime();
   return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
 }

 function roundToTwoDecimals(value: number): number {
   return Math.round(value * 100) / 100;
 }

 export function aggregateSummaries(
   response: WakaTimeSummariesResponse,
   start: Date,
   end: Date
 ): CodingSummary {
   const startDate = formatDate(start);
   const endDate = formatDate(end);
   const windowDays = daysBetweenInclusive(start, end);

   const days: DailySummary[] = response.data.map(day => ({
     date: day.range.date,
     totalSeconds: day.grand_total.total_seconds,
   }));

   const projectMap = new Map<string, number>();
   let totalSeconds = 0;

   for (const day of response.data) {
     totalSeconds += day.grand_total.total_seconds;

     for (const project of day.projects) {
       const current = projectMap.get(project.name) ?? 0;
       projectMap.set(project.name, current + project.total_seconds);
     }
   }

   const projects: ProjectSummary[] = Array.from(projectMap.entries())
     .map(([name, projectSeconds]) => ({
       name,
       totalSeconds: projectSeconds,
       percent: totalSeconds > 0 ? roundToTwoDecimals((projectSeconds / totalSeconds) * 100) : 0,
     }))
     .sort((a, b) => b.totalSeconds - a.totalSeconds);

   return {
     startDate,
     endDate,
     totalSeconds,
     dailyAverageSeconds: windowDays > 0 ? totalSeconds / windowDays : 0,
     days,
     projects,
   };
 }
