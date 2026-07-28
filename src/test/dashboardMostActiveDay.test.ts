import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function extractFunction(source: string, name: string): string {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `function ${name} not found in dashboard.ts`);
  const braceStart = source.indexOf('{', start);
  assert.notStrictEqual(braceStart, -1, `opening brace not found for ${name}`);
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

suite('dashboard mostActiveDay', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'dashboard.ts'),
    'utf8'
  );
  const factory = new Function(
    `${extractFunction(source, 'getMostActiveDay')}; return getMostActiveDay;`
  );
  const getMostActiveDay = factory() as (
    days: { date: string; totalSeconds: number }[] | null | undefined
  ) => { date: string; totalSeconds: number } | null;

  test('returns the day with the most coding seconds', () => {
    const days = [
      { date: '2026-07-20', totalSeconds: 100 },
      { date: '2026-07-21', totalSeconds: 500 },
      { date: '2026-07-22', totalSeconds: 300 },
    ];
    const result = getMostActiveDay(days);
    assert.ok(result);
    assert.strictEqual(result!.date, '2026-07-21');
    assert.strictEqual(result!.totalSeconds, 500);
  });

  test('returns null for empty array', () => {
    assert.strictEqual(getMostActiveDay([]), null);
  });

  test('returns null for null/undefined', () => {
    assert.strictEqual(getMostActiveDay(null), null);
    assert.strictEqual(getMostActiveDay(undefined), null);
  });

  test('handles single day', () => {
    const result = getMostActiveDay([{ date: '2026-07-20', totalSeconds: 200 }]);
    assert.ok(result);
    assert.strictEqual(result!.date, '2026-07-20');
  });
});
