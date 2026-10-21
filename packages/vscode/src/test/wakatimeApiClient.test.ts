import * as assert from 'assert';
import { withCredential } from '../collectors/wakatimeApiClient';

suite('withCredential', () => {
  test('appends api_key when the url already has a query string', () => {
    const url = withCredential(
      'https://wakatime.com/api/v1/users/current/summaries?start=2026-10-01&end=2026-10-07',
      'tok_123'
    );
    assert.strictEqual(
      url,
      'https://wakatime.com/api/v1/users/current/summaries?start=2026-10-01&end=2026-10-07&api_key=tok_123'
    );
  });

  test('appends api_key when the url has no query string', () => {
    assert.strictEqual(
      withCredential('https://wakatime.com/api/v1/users/current/status_bar/today', 'tok_123'),
      'https://wakatime.com/api/v1/users/current/status_bar/today?api_key=tok_123'
    );
  });

  test('encodes the credential', () => {
    assert.strictEqual(
      withCredential('https://x/y?z=1', 'a b&c'),
      'https://x/y?z=1&api_key=a%20b%26c'
    );
  });
});
