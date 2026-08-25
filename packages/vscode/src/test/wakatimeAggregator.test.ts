 import * as assert from 'assert';
 import { aggregateSummaries } from '../collectors/wakatimeAggregator';
 import { WakaTimeSummariesResponse } from '../collectors/wakatimeTypes';

 function dateRange(start: string, end: string): { start: Date; end: Date } {
   return { start: new Date(start), end: new Date(end) };
 }

 suite('aggregateSummaries', () => {
  test('returns empty summary for empty response', () => {
    const response: WakaTimeSummariesResponse = { data: [] };
    const { start, end } = dateRange('2026-07-20', '2026-07-26');

    const summary = aggregateSummaries(response, start, end);

    assert.strictEqual(summary.totalSeconds, 0);
    assert.strictEqual(summary.dailyAverageSeconds, 0);
    assert.strictEqual(summary.days.length, 7);
    assert.ok(summary.days.every(d => d.totalSeconds === 0));
    assert.deepStrictEqual(summary.projects, []);
  });

   test('aggregates single day with single project', () => {
     const response: WakaTimeSummariesResponse = {
       data: [
         {
           grand_total: { hours: 1, minutes: 30, total_seconds: 5400 },
           projects: [{ name: 'project-a', total_seconds: 5400 }],
           range: { date: '2026-07-20' },
         },
       ],
     };
     const { start, end } = dateRange('2026-07-20', '2026-07-20');

     const summary = aggregateSummaries(response, start, end);

     assert.strictEqual(summary.totalSeconds, 5400);
     assert.strictEqual(summary.dailyAverageSeconds, 5400);
     assert.strictEqual(summary.days.length, 1);
     assert.strictEqual(summary.days[0].date, '2026-07-20');
     assert.strictEqual(summary.days[0].totalSeconds, 5400);
     assert.strictEqual(summary.projects.length, 1);
     assert.strictEqual(summary.projects[0].name, 'project-a');
     assert.strictEqual(summary.projects[0].totalSeconds, 5400);
     assert.strictEqual(summary.projects[0].percent, 100);
   });

   test('merges same project across multiple days', () => {
     const response: WakaTimeSummariesResponse = {
       data: [
         {
           grand_total: { hours: 1, minutes: 0, total_seconds: 3600 },
           projects: [{ name: 'project-a', total_seconds: 3600 }],
           range: { date: '2026-07-20' },
         },
         {
           grand_total: { hours: 2, minutes: 0, total_seconds: 7200 },
           projects: [{ name: 'project-a', total_seconds: 7200 }],
           range: { date: '2026-07-21' },
         },
       ],
     };
     const { start, end } = dateRange('2026-07-20', '2026-07-21');

     const summary = aggregateSummaries(response, start, end);

     assert.strictEqual(summary.totalSeconds, 10800);
     assert.strictEqual(summary.dailyAverageSeconds, 5400);
     assert.strictEqual(summary.projects.length, 1);
     assert.strictEqual(summary.projects[0].name, 'project-a');
     assert.strictEqual(summary.projects[0].totalSeconds, 10800);
     assert.strictEqual(summary.projects[0].percent, 100);
   });

   test('aggregates multiple projects and calculates percentages', () => {
     const response: WakaTimeSummariesResponse = {
       data: [
         {
           grand_total: { hours: 3, minutes: 0, total_seconds: 10800 },
           projects: [
             { name: 'project-a', total_seconds: 3600 },
             { name: 'project-b', total_seconds: 7200 },
           ],
           range: { date: '2026-07-20' },
         },
       ],
     };
     const { start, end } = dateRange('2026-07-20', '2026-07-20');

     const summary = aggregateSummaries(response, start, end);

     assert.strictEqual(summary.totalSeconds, 10800);
     assert.strictEqual(summary.projects.length, 2);

     const projectA = summary.projects.find(p => p.name === 'project-a')!;
     const projectB = summary.projects.find(p => p.name === 'project-b')!;

     assert.strictEqual(projectA.totalSeconds, 3600);
     assert.strictEqual(projectA.percent, 33.33);
     assert.strictEqual(projectB.totalSeconds, 7200);
     assert.strictEqual(projectB.percent, 66.67);
   });

   test('sorts projects by total seconds descending', () => {
     const response: WakaTimeSummariesResponse = {
       data: [
         {
           grand_total: { hours: 1, minutes: 0, total_seconds: 3600 },
           projects: [
             { name: 'small', total_seconds: 600 },
             { name: 'large', total_seconds: 3000 },
           ],
           range: { date: '2026-07-20' },
         },
       ],
     };
     const { start, end } = dateRange('2026-07-20', '2026-07-20');

     const summary = aggregateSummaries(response, start, end);

     assert.deepStrictEqual(summary.projects.map(p => p.name), ['large', 'small']);
   });

  test('daily average is total over fixed window days', () => {
    const response: WakaTimeSummariesResponse = {
      data: [
        {
          grand_total: { hours: 2, minutes: 0, total_seconds: 7200 },
          projects: [{ name: 'project-a', total_seconds: 7200 }],
          range: { date: '2026-07-20' },
        },
      ],
    };
    const { start, end } = dateRange('2026-07-20', '2026-07-26');

    const summary = aggregateSummaries(response, start, end);

    assert.strictEqual(summary.totalSeconds, 7200);
    assert.strictEqual(summary.dailyAverageSeconds, Math.round(7200 / 7));
  });

  test('fills missing days with zero seconds', () => {
    const response: WakaTimeSummariesResponse = {
      data: [
        {
          grand_total: { hours: 1, minutes: 0, total_seconds: 3600 },
          projects: [{ name: 'project-a', total_seconds: 3600 }],
          range: { date: '2026-07-20' },
        },
      ],
    };
    const { start, end } = dateRange('2026-07-20', '2026-07-22');

    const summary = aggregateSummaries(response, start, end);

    assert.deepStrictEqual(
      summary.days.map(d => ({ date: d.date, totalSeconds: d.totalSeconds })),
      [
        { date: '2026-07-20', totalSeconds: 3600 },
        { date: '2026-07-21', totalSeconds: 0 },
        { date: '2026-07-22', totalSeconds: 0 },
      ]
    );
    assert.strictEqual(summary.totalSeconds, 3600);
    assert.strictEqual(summary.dailyAverageSeconds, Math.round(3600 / 3));
  });
 });
