 import * as vscode from 'vscode';
 import { DashboardPanel } from './dashboard';
 import { createWakaTimeCollector } from './collectors/wakatimeCollector';
 import { TimeCollector } from './models';

 const LAST_RECORDED_DATE_KEY = 'lastRecordedDate';

 export function activate(context: vscode.ExtensionContext): void {
   context.globalState.setKeysForSync([LAST_RECORDED_DATE_KEY]);

   const collector = createWakaTimeCollector();
   const statusBarItem = vscode.window.createStatusBarItem(
     vscode.StatusBarAlignment.Left,
     100
   );
   statusBarItem.command = 'codepulse.openDashboard';
   context.subscriptions.push(statusBarItem);

   const openDashboardCommand = vscode.commands.registerCommand(
     'codepulse.openDashboard',
     () => {
       if (!collector) {
         vscode.window.showErrorMessage(
           '未找到 WakaTime API Key。请先安装 WakaTime 插件并登录。'
         );
         return;
       }
       DashboardPanel.createOrShow(context.extensionUri, collector, context.globalState);
     }
   );

   const markRecordedCommand = vscode.commands.registerCommand(
     'codepulse.markTodayAsRecorded',
     () => {
       markTodayAsRecorded(context.globalState);
       vscode.window.showInformationMessage('已标记今天为已记录');
     }
   );

   context.subscriptions.push(openDashboardCommand, markRecordedCommand);

   if (collector) {
     updateStatusBar(statusBarItem, collector);
   }
 }

 export function deactivate(): void {
   // no-op
 }

 async function updateStatusBar(
   statusBarItem: vscode.StatusBarItem,
   collector: TimeCollector
 ): Promise<void> {
   try {
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     const summary = await collector.getSummaries(today, today);
     const todaySeconds = summary.days[0]?.totalSeconds ?? 0;
     statusBarItem.text = `$(pulse) ${formatDuration(todaySeconds)}`;
     statusBarItem.tooltip = 'CodePulse: 今日编码时长，点击打开面板';
     statusBarItem.show();
   } catch (error) {
     statusBarItem.text = '$(pulse) CodePulse';
     statusBarItem.tooltip = 'CodePulse: 点击打开面板';
     statusBarItem.show();
   }
 }

 function formatDuration(seconds: number): string {
   const hours = Math.floor(seconds / 3600);
   const mins = Math.floor((seconds % 3600) / 60);
   if (hours > 0) {
     return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
   }
   return `${mins}m`;
 }

 export function markTodayAsRecorded(globalState: vscode.Memento): void {
   const today = new Date().toISOString().split('T')[0];
   globalState.update(LAST_RECORDED_DATE_KEY, today);
 }

 export function getLastRecordedDate(globalState: vscode.Memento): string | undefined {
   return globalState.get<string>(LAST_RECORDED_DATE_KEY);
 }
