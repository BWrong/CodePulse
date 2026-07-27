 import * as vscode from 'vscode';
 import { DashboardPanel } from './dashboard';

 export function activate(context: vscode.ExtensionContext): void {
   const openDashboardCommand = vscode.commands.registerCommand(
     'codepulse.openDashboard',
     () => {
       DashboardPanel.createOrShow(context.extensionUri);
     }
   );

   context.subscriptions.push(openDashboardCommand);
 }

 export function deactivate(): void {
   // no-op
 }
