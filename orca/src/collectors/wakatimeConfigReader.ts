 import * as fs from 'fs';
 import * as os from 'os';

 export function readWakaTimeApiKey(homeDir?: string): string | undefined {
   const cfgPath = `${homeDir ?? os.homedir()}/.wakatime.cfg`;

   if (!fs.existsSync(cfgPath)) {
     return undefined;
   }

   const content = fs.readFileSync(cfgPath, 'utf-8');
   const match = content.match(/^\s*api_key\s*=\s*(.+?)\s*$/m);
   return match?.[1];
 }
