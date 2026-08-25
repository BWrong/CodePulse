 import * as assert from 'assert';
 import * as fs from 'fs';
 import * as os from 'os';
 import * as path from 'path';
 import { readWakaTimeApiKey } from '../collectors/wakatimeConfigReader';

 suite('readWakaTimeApiKey', () => {
   const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codepulse-test-'));

   suiteTeardown(() => {
     fs.rmSync(tempHome, { recursive: true, force: true });
   });

   test('returns undefined when config file does not exist', () => {
     const apiKey = readWakaTimeApiKey(tempHome);
     assert.strictEqual(apiKey, undefined);
   });

   test('reads api_key from wakatime.cfg', () => {
     const cfgPath = path.join(tempHome, '.wakatime.cfg');
     const config = `[settings]\napi_key = waka_12345\nhide_file_names = false\n`;
     fs.writeFileSync(cfgPath, config, 'utf-8');

     const apiKey = readWakaTimeApiKey(tempHome);

     assert.strictEqual(apiKey, 'waka_12345');
   });

   test('trims whitespace around api_key', () => {
     const cfgPath = path.join(tempHome, '.wakatime.cfg');
     const config = `[settings]\n  api_key =   waka_67890  \n`;
     fs.writeFileSync(cfgPath, config, 'utf-8');

     const apiKey = readWakaTimeApiKey(tempHome);

     assert.strictEqual(apiKey, 'waka_67890');
   });
 });
