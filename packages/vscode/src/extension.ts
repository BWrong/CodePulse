 import * as vscode from 'vscode';
 import { DashboardPanel } from './dashboard';
 import { createWakaTimeCollector } from './collectors/wakatimeCollector';
 import { TimeCollector } from './models';
 import { LAST_RECORDED_DATE_KEY, markTodayAsRecorded } from './recordedDate';

 const WAKATIME_SECRET_KEY = 'codepulse.wakatimeToken';

 async function resolveCollector(
   context: vscode.ExtensionContext
 ): Promise<TimeCollector | undefined> {
   const secret = await context.secrets.get(WAKATIME_SECRET_KEY);
   return createWakaTimeCollector(secret);
 }

 export async function activate(context: vscode.ExtensionContext): Promise<void> {
   context.globalState.setKeysForSync([LAST_RECORDED_DATE_KEY]);

   let collector = await resolveCollector(context);
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
           '未找到 WakaTime 凭证。请运行「CodePulse: 设置 WakaTime Token」，或安装并登录 WakaTime 插件。'
         );
         return;
       }
       DashboardPanel.createOrShow(
         context.extensionUri,
         collector,
         context.globalState,
         () => updateStatusBar(statusBarItem, collector!)
       );
     }
   );

   const setTokenCommand = vscode.commands.registerCommand(
     'codepulse.setWakatimeToken',
     async () => {
       const token = await vscode.window.showInputBox({
         title: 'CodePulse: 设置 WakaTime Token',
         prompt: '在 https://wakatime.com/oauth 获取个人 OAuth token，留空则清除已保存的值',
         password: true,
         ignoreFocusOut: true,
       });
       if (token === undefined) {
         return;
       }
       if (token.trim()) {
         await context.secrets.store(WAKATIME_SECRET_KEY, token.trim());
       } else {
         await context.secrets.delete(WAKATIME_SECRET_KEY);
       }
       collector = await resolveCollector(context);
       vscode.window.showInformationMessage('CodePulse: WakaTime 凭证已更新');
       if (collector) {
         updateStatusBar(statusBarItem, collector);
       }
     }
   );

   const markRecordedCommand = vscode.commands.registerCommand(
     'codepulse.markTodayAsRecorded',
     async () => {
       await markTodayAsRecorded(context.globalState);
       vscode.window.showInformationMessage('已标记今天为已记录');
     }
   );

   context.subscriptions.push(openDashboardCommand, markRecordedCommand, setTokenCommand);

   const statusBarRefreshInterval = setInterval(() => {
     if (collector) {
       updateStatusBar(statusBarItem, collector);
     }
   }, 5 * 60 * 1000);
   context.subscriptions.push({
     dispose: () => clearInterval(statusBarRefreshInterval),
   });

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
     console.error('[CodePulse] updateStatusBar failed:', error);
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
