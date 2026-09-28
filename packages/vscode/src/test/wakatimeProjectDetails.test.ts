import * as assert from 'assert';
import { aggregateProjectDetails } from '../collectors/wakatimeAggregator';
import { WakaTimeSummariesResponse } from '../collectors/wakatimeTypes';

suite('aggregateProjectDetails', () => {
  test('returns empty details for empty response', () => {
    const response: WakaTimeSummariesResponse = { data: [] };

    const details = aggregateProjectDetails(response, 'project-a');

    assert.strictEqual(details.project, 'project-a');
    assert.strictEqual(details.totalSeconds, 0);
    assert.deepStrictEqual(details.ai, {
      aiTotalTokens: 0,
      aiModelCost: 0,
      aiCacheHitRate: 0,
      aiLineRatio: 0,
      aiLines: 0,
      humanLines: 0,
      aiSessions: 0,
    });
    assert.deepStrictEqual(details.editors, []);
    assert.deepStrictEqual(details.categories, []);
  });

  test('aggregates total seconds and AI stats from grand_total', () => {
    const response: WakaTimeSummariesResponse = {
      data: [
        {
          grand_total: {
            hours: 1,
            minutes: 0,
            total_seconds: 3600,
            ai_additions: 100,
            ai_deletions: 50,
            human_additions: 200,
            human_deletions: 50,
            ai_input_tokens: 100,
            ai_cached_input_tokens: 50,
            ai_output_tokens: 200,
            ai_model_total_cost: 0.01,
            ai_sessions: 3,
          },
          projects: [],
          editors: [{ name: 'VS Code', total_seconds: 3600 }],
          categories: [{ name: 'Coding', total_seconds: 3600 }],
          range: { date: '2026-07-20' },
        },
        {
          grand_total: {
            hours: 2,
            minutes: 0,
            total_seconds: 7200,
            ai_additions: 300,
            ai_deletions: 100,
            human_additions: 600,
            human_deletions: 100,
            ai_input_tokens: 300,
            ai_cached_input_tokens: 150,
            ai_output_tokens: 400,
            ai_model_total_cost: 0.02,
            ai_sessions: 7,
          },
          projects: [],
          editors: [
            { name: 'VS Code', total_seconds: 5000 },
            { name: 'IntelliJ', total_seconds: 2200 },
          ],
          categories: [
            { name: 'Coding', total_seconds: 5000 },
            { name: 'Debugging', total_seconds: 2200 },
          ],
          range: { date: '2026-07-21' },
        },
      ],
    };

    const details = aggregateProjectDetails(response, 'project-a');

    assert.strictEqual(details.totalSeconds, 10800);
    assert.deepStrictEqual(details.ai, {
      aiTotalTokens: 1200,
      aiModelCost: 0.03,
      aiCacheHitRate: 0.3333333333333333,
      aiLineRatio: 0.36666666666666664,
      aiLines: 550,
      humanLines: 950,
      aiSessions: 10,
    });
    assert.strictEqual(details.editors.length, 2);
    assert.strictEqual(details.editors[0].name, 'VS Code');
    assert.strictEqual(details.editors[0].totalSeconds, 8600);
    assert.strictEqual(details.editors[0].percent, 79.63);
    assert.strictEqual(details.editors[1].name, 'IntelliJ');
    assert.strictEqual(details.editors[1].totalSeconds, 2200);
    assert.strictEqual(details.editors[1].percent, 20.37);
    assert.strictEqual(details.categories.length, 2);
    assert.strictEqual(details.categories[0].name, 'Coding');
    assert.strictEqual(details.categories[0].totalSeconds, 8600);
    assert.strictEqual(details.categories[1].name, 'Debugging');
    assert.strictEqual(details.categories[1].totalSeconds, 2200);
  });

  test('handles missing grand_total gracefully', () => {
    const response: WakaTimeSummariesResponse = {
      data: [
        {
          grand_total: { hours: 0, minutes: 0, total_seconds: 0 },
          projects: [],
          range: { date: '2026-07-20' },
        },
      ],
    };

    const details = aggregateProjectDetails(response, 'project-a');

    assert.strictEqual(details.totalSeconds, 0);
    assert.deepStrictEqual(details.ai, {
      aiTotalTokens: 0,
      aiModelCost: 0,
      aiCacheHitRate: 0,
      aiLineRatio: 0,
      aiLines: 0,
      humanLines: 0,
      aiSessions: 0,
    });
    assert.deepStrictEqual(details.editors, []);
    assert.deepStrictEqual(details.categories, []);
  });
});