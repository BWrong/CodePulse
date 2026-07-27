 import * as https from 'https';
 import { WakaTimeSummariesResponse } from './wakatimeTypes';

 function formatDate(date: Date): string {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
 }

 export function fetchWakaTimeSummaries(
   apiKey: string,
   start: Date,
   end: Date
 ): Promise<WakaTimeSummariesResponse> {
   const startStr = formatDate(start);
   const endStr = formatDate(end);
   const url = `https://wakatime.com/api/v1/users/current/summaries?start=${startStr}&end=${endStr}`;
   const auth = Buffer.from(`${apiKey}:`).toString('base64');

   return new Promise((resolve, reject) => {
     https
       .get(
         url,
         {
           headers: {
             Authorization: `Basic ${auth}`,
             Accept: 'application/json',
           },
         },
         res => {
           let data = '';
           res.on('data', chunk => {
             data += chunk;
           });
           res.on('end', () => {
             if (res.statusCode === 200) {
               try {
                 resolve(JSON.parse(data));
               } catch (error) {
                 reject(new Error(`Failed to parse WakaTime response: ${error}`));
               }
             } else {
               reject(
                 new Error(
                   `WakaTime API returned ${res.statusCode}: ${data.slice(0, 200)}`
                 )
               );
             }
           });
         }
       )
       .on('error', error => {
         reject(error);
       });
   });
 }
