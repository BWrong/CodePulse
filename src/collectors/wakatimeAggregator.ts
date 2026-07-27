 import { CodingSummary, DailySummary, ProjectSummary } from '../models';
 import { WakaTimeSummariesResponse } from './wakatimeTypes';
 import { formatDate } from '../utils/date';

 function daysBetweenInclusive(start: Date, end: Date): number {
   const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
   const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
   const diffMs = endMidnight.getTime() - startMidnight.getTime();
   return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
 }

 function roundToTwoDecimals(value: number): number {
   return Math.round(value * 100) / 100;
 }

 function addDays(date: Date, days: number): Date {
   const result = new Date(date);
   result.setDate(result.getDate() + days);
   return result;
 }

 export function aggregateSummaries(
   response: WakaTimeSummariesResponse,
   start: Date,
   end: Date
 ): CodingSummary {
   const startDate = formatDate(start);
   const endDate = formatDate(end);
   const windowDays = daysBetweenInclusive(start, end);

   const secondsByDate = new Map<string, number>();
   const projectsByDate = new Map<string, { name: string; totalSeconds: number }[]>();
   for (const day of response.data) {
     secondsByDate.set(day.range.date, day.grand_total.total_seconds);
     projectsByDate.set(
       day.range.date,
       day.projects
        .filter(p => p.total_seconds > 0)
        .map(p => ({ name: p.name, totalSeconds: p.total_seconds }))
     );
   }

   const days: DailySummary[] = [];
   for (let i = 0; i < windowDays; i++) {
     const date = formatDate(addDays(start, i));
     days.push({
       date,
       totalSeconds: secondsByDate.get(date) ?? 0,
       projects: projectsByDate.get(date) ?? [],
     });
   }

   const projectMap = new Map<string, number>();
   let totalSeconds = 0;

   for (const day of response.data) {
     totalSeconds += day.grand_total.total_seconds;

     for (const project of day.projects) {
       if (project.total_seconds === 0) {
         continue;
       }
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
     dailyAverageSeconds: windowDays > 0 ? Math.round(totalSeconds / windowDays) : 0,
     days,
     projects,
   };
 }
