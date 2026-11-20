import * as assert from 'assert';
import { aggregateDurations } from '../collectors/durationsAggregator';
import { WakaTimeDurationsResponse } from '../collectors/wakatimeTypes';

function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function msToTime(ms: number): number {
  return ms / 1000;
}

suite('aggregateDurations', () => {
  const date = makeDate(2026, 7, 28);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();

  test('returns empty distribution for empty response', () => {
    const response: WakaTimeDurationsResponse = {
      data: [],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    assert.strictEqual(result.totalSeconds, 0);
    assert.strictEqual(result.projects.length, 0);
    assert.strictEqual(result.date, '2026-07-28');
  });

  test('single project single session within one hour', () => {
    // Session: 10:00 - 10:30 (30 min)
    const sessionStartMs = dayStartMs + 10 * 3600 * 1000;
    const sessionEndMs = sessionStartMs + 30 * 60 * 1000;
    const response: WakaTimeDurationsResponse = {
      data: [
        {
          project: 'project-a',
          duration: 30 * 60,
          time: msToTime(sessionEndMs),
        },
      ],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    assert.strictEqual(result.projects.length, 1);
    assert.strictEqual(result.projects[0].name, 'project-a');
    assert.ok(Math.abs(result.projects[0].totalSeconds - 1800) < 1);
    assert.ok(result.projects[0].buckets[10].coveredSeconds > 0);
    assert.strictEqual(result.projects[0].buckets[9].coveredSeconds, 0);
    assert.strictEqual(result.projects[0].buckets[10].sessions.length, 1);
  });

  test('cross-hour session is split into two buckets', () => {
    // Session: 9:30 - 10:15 (45 min)
    const sessionStartMs = dayStartMs + 9.5 * 3600 * 1000;
    const sessionEndMs = sessionStartMs + 45 * 60 * 1000;
    const response: WakaTimeDurationsResponse = {
      data: [
        {
          project: 'project-a',
          duration: 45 * 60,
          time: msToTime(sessionEndMs),
        },
      ],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    const project = result.projects[0];
    // Hour 9: 9:30 - 10:00 = 30 min = 1800 sec
    assert.ok(Math.abs(project.buckets[9].coveredSeconds - 1800) < 1);
    // Hour 10: 10:00 - 10:15 = 15 min = 900 sec
    assert.ok(Math.abs(project.buckets[10].coveredSeconds - 900) < 1);
    // Each bucket has one session slice
    assert.strictEqual(project.buckets[9].sessions.length, 1);
    assert.strictEqual(project.buckets[10].sessions.length, 1);
  });

  test('multiple projects sorted by total seconds descending', () => {
    const startA = dayStartMs + 10 * 3600 * 1000;
    const startB = dayStartMs + 14 * 3600 * 1000;
    const response: WakaTimeDurationsResponse = {
      data: [
        {
          project: 'small',
          duration: 10 * 60,
          time: msToTime(startA + 10 * 60 * 1000),
        },
        {
          project: 'large',
          duration: 60 * 60,
          time: msToTime(startB + 60 * 60 * 1000),
        },
      ],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    assert.deepStrictEqual(
      result.projects.map(p => p.name),
      ['large', 'small']
    );
  });

  test('percent calculated correctly', () => {
    const start = dayStartMs + 10 * 3600 * 1000;
    const response: WakaTimeDurationsResponse = {
      data: [
        {
          project: 'a',
          duration: 3600,
          time: msToTime(start + 3600 * 1000),
        },
        {
          project: 'b',
          duration: 7200,
          time: msToTime(start + 3 * 3600 * 1000),
        },
      ],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    const a = result.projects.find(p => p.name === 'a')!;
    const b = result.projects.find(p => p.name === 'b')!;
    assert.ok(Math.abs(a.percent - 33.33) < 0.1);
    assert.ok(Math.abs(b.percent - 66.67) < 0.1);
  });

  test('sessions outside the day are skipped', () => {
    // Session on previous day
    const prevDayEnd = dayStartMs - 1;
    const response: WakaTimeDurationsResponse = {
      data: [
        {
          project: 'project-a',
          duration: 60,
          time: msToTime(prevDayEnd),
        },
      ],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    assert.strictEqual(result.projects.length, 0);
    assert.strictEqual(result.totalSeconds, 0);
  });

  test('each project has 24 buckets', () => {
    const start = dayStartMs + 10 * 3600 * 1000;
    const response: WakaTimeDurationsResponse = {
      data: [
        {
          project: 'project-a',
          duration: 60,
          time: msToTime(start + 60 * 1000),
        },
      ],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    assert.strictEqual(result.projects[0].buckets.length, 24);
    for (let h = 0; h < 24; h++) {
      assert.strictEqual(result.projects[0].buckets[h].hour, h);
    }
  });

  test('session spanning midnight is clamped to day start', () => {
    // Session: 23:45 previous day - 00:15 this day (30 min)
    // Only the part within this day (00:00 - 00:15 = 15 min) should count
    const sessionEndMs = dayStartMs + 15 * 60 * 1000; // 00:15 this day
    const response: WakaTimeDurationsResponse = {
      data: [
        {
          project: 'project-a',
          duration: 30 * 60,
          time: msToTime(sessionEndMs),
        },
      ],
      start: '',
      end: '',
      timezone: 'UTC',
    };

    const result = aggregateDurations(response, date);

    const project = result.projects[0];
    // Only 15 min within this day
    assert.ok(Math.abs(project.totalSeconds - 900) < 1);
    // Hour 0 should have 15 min
    assert.ok(Math.abs(project.buckets[0].coveredSeconds - 900) < 1);
  });
});
