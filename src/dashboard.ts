 import * as vscode from 'vscode';

 export class DashboardPanel {
   public static readonly viewType = 'codepulse.dashboard';

   private static currentPanel: DashboardPanel | undefined;
   private readonly panel: vscode.WebviewPanel;

   private constructor(extensionUri: vscode.Uri) {
     this.panel = vscode.window.createWebviewPanel(
       DashboardPanel.viewType,
       'CodePulse',
       vscode.ViewColumn.One,
       {
         enableScripts: true,
         localResourceRoots: [extensionUri],
       }
     );

     this.panel.webview.html = this.getHtmlForWebview();
   }

   public static createOrShow(extensionUri: vscode.Uri): DashboardPanel {
     if (DashboardPanel.currentPanel) {
       DashboardPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
       return DashboardPanel.currentPanel;
     }

     const panel = new DashboardPanel(extensionUri);
     DashboardPanel.currentPanel = panel;

     panel.panel.onDidDispose(() => {
       DashboardPanel.currentPanel = undefined;
     });

     return panel;
   }

   private getHtmlForWebview(): string {
     return `<!DOCTYPE html>
 <html lang="zh-CN">
 <head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>CodePulse</title>
 </head>
 <body>
   <h1>CodePulse</h1>
   <p>Dashboard is coming soon.</p>
 </body>
 </html>`;
   }
 }
