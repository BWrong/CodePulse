import * as vscode from 'vscode';
import { DashboardPanel } from './dashboard';

export function activate(context: vscode.ExtensionContext): void {
  const openDashboardCommand = vscode.commands.registerCommand(
    'codepulse.openDashboard',
    () => {
       const collector = createWakaTimeCollector();
       if (!collector) {
         vscode.window.showErrorMessage(
           '未找到 WakaTime API Key。请先安装 WakaTime 插件并登录。'
         );
         return;
       }
       DashboardPanel.createOrShow(context.extensionUri, collector);
    }
  );

  context.subscriptions.push(openDashboardCommand);
}

export function deactivate(): void {
  // no-op
}
 
 function createWakaTimeCollector(): import('./models').TimeCollector | undefined {
   const { createWakaTimeCollector: factory } = require('./collectors/wakatimeCollector');
   return factory();
 }
