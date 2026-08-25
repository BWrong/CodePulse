import * as vscode from 'vscode';
import { formatDate } from './utils/date';

export const LAST_RECORDED_DATE_KEY = 'lastRecordedDate';

function formatLocalDateTime(date: Date): string {
  const time = [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ]
    .map(part => String(part).padStart(2, '0'))
    .join(':');
  return `${formatDate(date)} ${time}`;
}

export async function markTodayAsRecorded(globalState: vscode.Memento): Promise<void> {
  const today = formatLocalDateTime(new Date());
  await globalState.update(LAST_RECORDED_DATE_KEY, today);
}

 export function getLastRecordedDate(globalState: vscode.Memento): string | undefined {
   return globalState.get<string>(LAST_RECORDED_DATE_KEY);
 }
