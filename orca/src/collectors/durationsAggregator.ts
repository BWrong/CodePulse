import {
  ProjectDayDistribution,
  ProjectDistribution,
  ProjectSession,
} from '../models';
import { WakaTimeDurationsResponse } from './wakatimeTypes';
import { formatDate } from '../utils/date';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function sliceSessionToHour(
  sessionStartMs: number,
  sessionEndMs: number,
  hour: number,
  dayStartMs: number
): { coveredSeconds: number; start: string; end: string } | null {
  const hourStartMs = dayStartMs + hour * 3600 * 1000;
  const hourEndMs = hourStartMs + 3600 * 1000;
  const sliceStart = Math.max(sessionStartMs, hourStartMs);
  const sliceEnd = Math.min(sessionEndMs, hourEndMs);
  if (sliceEnd <= sliceStart) {
    return null;
  }
  return {
    coveredSeconds: (sliceEnd - sliceStart) / 1000,
    start: toIso(sliceStart),
    end: toIso(sliceEnd),
  };
}

function mergeOverlapping(
  sessions: { start: number; end: number }[]
): { start: number; end: number }[] {
  if (sessions.length === 0) return [];
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

export function aggregateDurations(
  response: WakaTimeDurationsResponse,
  date: Date
): ProjectDayDistribution {
  const dayStart = startOfDay(date);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 24 * 3600 * 1000;
  const dateStr = formatDate(date);

  // 1. 按项目收集原始 session（clamp 到当天范围）
  const rawSessions = new Map<string, { start: number; end: number }[]>();

  for (const dur of response.data) {
    if (!dur.project || dur.duration <= 0 || dur.time == null) {
      continue;
    }

    const sessionEndMs = dur.time * 1000;
    const sessionStartMs = sessionEndMs - dur.duration * 1000;

    if (sessionEndMs <= dayStartMs || sessionStartMs >= dayEndMs) {
      continue;
    }

    const clampedStart = Math.max(sessionStartMs, dayStartMs);
    const clampedEnd = Math.min(sessionEndMs, dayEndMs);

    let list = rawSessions.get(dur.project);
    if (!list) {
      list = [];
      rawSessions.set(dur.project, list);
    }
    list.push({ start: clampedStart, end: clampedEnd });
  }

  // 2. 每个项目合并重叠 session，再计算 buckets 和总时长
  const projectMap = new Map<string, ProjectDistribution>();

  for (const [projectName, sessions] of rawSessions) {
    const merged = mergeOverlapping(sessions);

    let totalSeconds = 0;
    for (const s of merged) {
      totalSeconds += (s.end - s.start) / 1000;
    }

    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      coveredSeconds: 0,
      sessions: [] as ProjectSession[],
    }));

    for (const s of merged) {
      for (let hour = 0; hour < 24; hour++) {
        const slice = sliceSessionToHour(s.start, s.end, hour, dayStartMs);
        if (slice) {
          const bucket = buckets[hour];
          bucket.coveredSeconds += slice.coveredSeconds;
          bucket.sessions.push({ start: slice.start, end: slice.end });
        }
      }
    }

    projectMap.set(projectName, {
      name: projectName,
      totalSeconds,
      percent: 0,
      buckets,
    });
  }

  const projects = Array.from(projectMap.values());
  const totalSeconds = projects.reduce((sum, p) => sum + p.totalSeconds, 0);
  for (const p of projects) {
    p.percent = totalSeconds > 0
      ? Math.round((p.totalSeconds / totalSeconds) * 100 * 100) / 100
      : 0;
  }
  projects.sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    date: dateStr,
    totalSeconds,
    projects,
  };
}
