import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function extractFunction(source: string, name: string): string {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `function ${name} not found in dashboard.ts`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        break;
      }
    }
  }
  assert.strictEqual(depth, 0, `unbalanced braces for ${name}`);
  return source.slice(start, i + 1);
}

function extractFunctions(source: string, names: string[]): string {
  return names.map(n => extractFunction(source, n)).join('\n');
}

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'dashboard.ts'),
  'utf8'
);

suite('dashboard getUnrecordedProjects', () => {
  const getUnrecordedProjects = new Function(
    `${extractFunctions(source, ['getUnrecordedProjects'])}; return getUnrecordedProjects;`
  )() as (
    summary: { days: { date: string; totalSeconds: number; projects: { name: string; totalSeconds: number }[] }[] } | null,
    lastRecordedDate: string | null | undefined
  ) => { totalSeconds: number; projects: { name: string; totalSeconds: number; percent: number }[] } | null;

  const days = [
    { date: '2026-07-22', totalSeconds: 100, projects: [{ name: 'a', totalSeconds: 100 }] },
    { date: '2026-07-23', totalSeconds: 200, projects: [{ name: 'a', totalSeconds: 200 }] },
    { date: '2026-07-25', totalSeconds: 300, projects: [{ name: 'b', totalSeconds: 300 }] },
    { date: '2026-07-28', totalSeconds: 400, projects: [{ name: 'b', totalSeconds: 400 }] },
  ];

  test('null lastRecordedDate returns null (never recorded)', () => {
    assert.strictEqual(getUnrecordedProjects({ days }, null), null);
    assert.strictEqual(getUnrecordedProjects({ days }, undefined), null);
  });

  test('includes days on or after lastRecordedDate', () => {
    // date >= 2026-07-25 -> 07-25, 07-28 (b: 700)
    const r = getUnrecordedProjects({ days }, '2026-07-25 10:00:00');
    assert.ok(r);
    assert.strictEqual(r!.totalSeconds, 700);
    assert.strictEqual(r!.projects.length, 1);
    assert.strictEqual(r!.projects[0].name, 'b');
    assert.strictEqual(r!.projects[0].totalSeconds, 700);
  });

  test('today as lastRecordedDate includes today', () => {
    // date >= 2026-07-28 -> 07-28 (b: 400)
    const r = getUnrecordedProjects({ days }, '2026-07-28 10:00:00');
    assert.ok(r);
    assert.strictEqual(r!.totalSeconds, 400);
    assert.strictEqual(r!.projects.length, 1);
    assert.strictEqual(r!.projects[0].name, 'b');
  });

  test('undefined summary returns null', () => {
    assert.strictEqual(getUnrecordedProjects(null, null), null);
  });
});

suite('dashboard computeUnrecorded', () => {
  const computeUnrecorded = new Function(
    'MIN_PROJECT_SECONDS',
    `${extractFunctions(source, ['getUnrecordedProjects', 'filterProjectsByMinDuration', 'computeUnrecorded'])}; return computeUnrecorded;`
  )(60) as (
    summary: { days: { date: string; totalSeconds: number; projects: { name: string; totalSeconds: number }[] }[] } | null,
    lastRecordedDate: string | null | undefined
  ) => { totalSeconds: number; projects: { name: string; totalSeconds: number; percent: number }[] } | null;

  test('totalSeconds matches filtered projects sum', () => {
    const days = [
      { date: '2026-07-22', totalSeconds: 200, projects: [{ name: 'a', totalSeconds: 200 }] },
      { date: '2026-07-23', totalSeconds: 30, projects: [{ name: 'b', totalSeconds: 30 }] },
    ];
    const r = computeUnrecorded({ days }, '2026-07-21 10:00:00');
    assert.ok(r);
    assert.strictEqual(r!.projects.length, 1);
    assert.strictEqual(r!.projects[0].name, 'a');
    assert.strictEqual(r!.totalSeconds, 200);
    assert.strictEqual(r!.totalSeconds, r!.projects.reduce((s, p) => s + p.totalSeconds, 0));
  });

  test('all projects under 1 minute yields zero total and empty list', () => {
    const days = [
      { date: '2026-07-22', totalSeconds: 30, projects: [{ name: 'a', totalSeconds: 30 }] },
    ];
    const r = computeUnrecorded({ days }, '2026-07-21 10:00:00');
    assert.ok(r);
    assert.strictEqual(r!.projects.length, 0);
    assert.strictEqual(r!.totalSeconds, 0);
  });

  test('null lastRecordedDate returns null (never recorded)', () => {
    const days = [
      { date: '2026-07-22', totalSeconds: 200, projects: [{ name: 'a', totalSeconds: 200 }] },
    ];
    assert.strictEqual(computeUnrecorded({ days }, null), null);
  });

  test('null summary returns null', () => {
    assert.strictEqual(computeUnrecorded(null, null), null);
  });

  test('default 5 minute (300s) threshold filters projects under 300s', () => {
    const computeUnrecordedDefault = new Function(
      'MIN_PROJECT_SECONDS',
      `${extractFunctions(source, ['getUnrecordedProjects', 'filterProjectsByMinDuration', 'computeUnrecorded'])}; return computeUnrecorded;`
    )(300) as (
      summary: { days: { date: string; totalSeconds: number; projects: { name: string; totalSeconds: number }[] }[] } | null,
      lastRecordedDate: string | null | undefined
    ) => { totalSeconds: number; projects: { name: string; totalSeconds: number; percent: number }[] } | null;
    const days = [
      { date: '2026-07-22', totalSeconds: 400, projects: [{ name: 'a', totalSeconds: 400 }] },
      { date: '2026-07-23', totalSeconds: 200, projects: [{ name: 'b', totalSeconds: 200 }] },
    ];
    const r = computeUnrecordedDefault({ days }, '2026-07-21 10:00:00');
    assert.ok(r);
    assert.strictEqual(r!.projects.length, 1);
    assert.strictEqual(r!.projects[0].name, 'a');
    assert.strictEqual(r!.totalSeconds, 400);
  });
});

suite('dashboard getDataEndDate', () => {
  const getDataEndDate = new Function(
    `${extractFunctions(source, ['getDataEndDate'])}; return getDataEndDate;`
  )() as (lastRecordedDate: string | null | undefined) => string | null;

  test('returns previous day of recorded date', () => {
    assert.strictEqual(getDataEndDate('2026-07-28 09:44:31'), '2026-07-27');
  });

  test('crosses month boundary', () => {
    assert.strictEqual(getDataEndDate('2026-08-01 00:00:00'), '2026-07-31');
  });

  test('null/undefined returns null', () => {
    assert.strictEqual(getDataEndDate(null), null);
    assert.strictEqual(getDataEndDate(undefined), null);
  });
});

suite('dashboard dayFilteredSeconds', () => {
  const dayFilteredSeconds = new Function(
    'MIN_PROJECT_SECONDS',
    `${extractFunctions(source, ['dayFilteredSeconds'])}; return dayFilteredSeconds;`
  )(60) as (day: { date?: string; totalSeconds?: number; projects?: { totalSeconds: number }[] }) => number;

  test('sums only projects at or above 1 minute', () => {
    const day = { date: '2026-07-28', totalSeconds: 230, projects: [
      { name: 'a', totalSeconds: 120 },
      { name: 'b', totalSeconds: 30 },
      { name: 'c', totalSeconds: 80 },
    ]};
    assert.strictEqual(dayFilteredSeconds(day), 200);
  });

  test('all projects under 1 minute yields 0', () => {
    const day = { date: '2026-07-28', totalSeconds: 50, projects: [
      { name: 'a', totalSeconds: 30 },
      { name: 'b', totalSeconds: 20 },
    ]};
    assert.strictEqual(dayFilteredSeconds(day), 0);
  });

  test('empty projects yields 0', () => {
    assert.strictEqual(dayFilteredSeconds({ date: '2026-07-28', totalSeconds: 0, projects: [] }), 0);
  });

  test('missing projects yields 0', () => {
    assert.strictEqual(dayFilteredSeconds({ date: '2026-07-28', totalSeconds: 0 }), 0);
  });

  test('5 minute (300s) threshold sums only projects at or above 300s', () => {
    const dayFilteredSecondsDefault = new Function(
      'MIN_PROJECT_SECONDS',
      `${extractFunctions(source, ['dayFilteredSeconds'])}; return dayFilteredSeconds;`
    )(300) as (day: { date?: string; totalSeconds?: number; projects?: { totalSeconds: number }[] }) => number;
    const day = { date: '2026-07-28', totalSeconds: 650, projects: [
      { name: 'a', totalSeconds: 400 },
      { name: 'b', totalSeconds: 250 },
      { name: 'c', totalSeconds: 50 },
    ]};
    assert.strictEqual(dayFilteredSecondsDefault(day), 400);
  });
});
