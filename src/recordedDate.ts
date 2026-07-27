 import * as vscode from 'vscode';
 import { formatDate } from './utils/date';

 export const LAST_RECORDED_DATE_KEY = 'lastRecordedDate';

 export async function markTodayAsRecorded(globalState: vscode.Memento): Promise<void> {
   const today = formatDate(new Date());
   await globalState.update(LAST_RECORDED_DATE_KEY, today);
 }

 export function getLastRecordedDate(globalState: vscode.Memento): string | undefined {
   return globalState.get<string>(LAST_RECORDED_DATE_KEY);
 }
