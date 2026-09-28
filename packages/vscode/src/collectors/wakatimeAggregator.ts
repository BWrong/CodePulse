 import { CodingSummary, DailySummary, ProjectDetails, ProjectDimensionItem, ProjectSummary } from '../models';
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

export function aggregateProjectDetails(
  response: WakaTimeSummariesResponse,
  project: string
): ProjectDetails {
  let totalSeconds = 0;
  let aiAdditions = 0;
  let aiDeletions = 0;
  let humanAdditions = 0;
  let humanDeletions = 0;
  let aiInputTokens = 0;
  let aiCachedInputTokens = 0;
  let aiOutputTokens = 0;
  let aiModelCost = 0;
  let aiSessions = 0;

  const editorMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  for (const day of response.data) {
    totalSeconds += day.grand_total?.total_seconds ?? 0;
    aiAdditions += day.grand_total?.ai_additions ?? 0;
    aiDeletions += day.grand_total?.ai_deletions ?? 0;
    humanAdditions += day.grand_total?.human_additions ?? 0;
    humanDeletions += day.grand_total?.human_deletions ?? 0;
    aiInputTokens += day.grand_total?.ai_input_tokens ?? 0;
    aiCachedInputTokens += day.grand_total?.ai_cached_input_tokens ?? 0;
    aiOutputTokens += day.grand_total?.ai_output_tokens ?? 0;
    aiModelCost += day.grand_total?.ai_model_total_cost ?? 0;
    aiSessions += day.grand_total?.ai_sessions ?? 0;

    for (const ed of day.editors ?? []) {
      if (ed.total_seconds <= 0) continue;
      editorMap.set(ed.name, (editorMap.get(ed.name) ?? 0) + ed.total_seconds);
    }
    for (const cat of day.categories ?? []) {
      if (cat.total_seconds <= 0) continue;
      categoryMap.set(cat.name, (categoryMap.get(cat.name) ?? 0) + cat.total_seconds);
    }
  }

  const aiTotalInput = aiInputTokens + aiCachedInputTokens;
  const aiCacheHitRate = aiTotalInput > 0 ? aiCachedInputTokens / aiTotalInput : 0;

  const aiLines = aiAdditions + aiDeletions;
  const totalLines = aiLines + humanAdditions + humanDeletions;
  const aiLineRatio = totalLines > 0 ? aiLines / totalLines : 0;

  const toDimensionItems = (map: Map<string, number>): ProjectDimensionItem[] => {
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([name, totalSeconds]) => ({
        name,
        totalSeconds,
        percent: total > 0 ? roundToTwoDecimals((totalSeconds / total) * 100) : 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  };

  return {
    project,
    totalSeconds,
    ai: {
      aiTotalTokens: aiInputTokens + aiCachedInputTokens + aiOutputTokens,
      aiModelCost,
      aiCacheHitRate,
      aiLineRatio,
      aiLines,
      humanLines: humanAdditions + humanDeletions,
      aiSessions,
    },
    editors: toDimensionItems(editorMap),
    categories: toDimensionItems(categoryMap),
  };
}
