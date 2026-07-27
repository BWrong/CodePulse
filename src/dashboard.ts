 import * as vscode from 'vscode';
 import { CodingSummary, TimeCollector } from './models';
 import { getLastRecordedDate, markTodayAsRecorded } from './recordedDate';

 export type RangeDays = 7 | 30 | 90;

 export interface DashboardMessage {
   command: 'ready' | 'refresh' | 'changeRange' | 'markRecorded' | 'openExternal';
   days?: RangeDays;
   url?: string;
 }

 export interface DashboardState {
   extensionUri: vscode.Uri;
   collector: TimeCollector;
   globalState: vscode.Memento;
   onDataUpdated?: (summary: CodingSummary) => void;
 }

 export class DashboardPanel {
   public static readonly viewType = 'codepulse.dashboard';

   private static currentPanel: DashboardPanel | undefined;
   private readonly panel: vscode.WebviewPanel;
   private readonly collector: TimeCollector;
   private readonly globalState: vscode.Memento;
   private readonly onDataUpdated?: (summary: CodingSummary) => void;
   private currentDays: RangeDays = 7;
   private isLoading = false;

   private constructor(extensionUri: vscode.Uri, state: DashboardState) {
     this.collector = state.collector;
     this.globalState = state.globalState;
     this.onDataUpdated = state.onDataUpdated;
     this.panel = vscode.window.createWebviewPanel(
       DashboardPanel.viewType,
       'CodePulse',
       vscode.ViewColumn.One,
       {
         enableScripts: true,
         localResourceRoots: [extensionUri],
       }
     );

     this.panel.webview.html = this.getHtmlForWebview(extensionUri);
     this.setupMessageHandling();
   }

   public static createOrShow(
     extensionUri: vscode.Uri,
     collector: TimeCollector,
     globalState: vscode.Memento,
     onDataUpdated?: (summary: CodingSummary) => void
   ): DashboardPanel {
     if (DashboardPanel.currentPanel) {
       DashboardPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
       return DashboardPanel.currentPanel;
     }

     const panel = new DashboardPanel(extensionUri, {
       extensionUri,
       collector,
       globalState,
       onDataUpdated,
     });
     DashboardPanel.currentPanel = panel;

     panel.panel.onDidDispose(() => {
       DashboardPanel.currentPanel = undefined;
     });

     return panel;
   }

   private setupMessageHandling(): void {
     this.panel.webview.onDidReceiveMessage(async (message: DashboardMessage) => {
       switch (message.command) {
         case 'ready':
           await this.sendInitialState();
           break;
         case 'refresh':
           await this.loadAndSendData();
           break;
         case 'changeRange':
           if (message.days) {
             this.currentDays = message.days;
             await this.loadAndSendData();
           }
           break;
         case 'markRecorded':
           await markTodayAsRecorded(this.globalState);
           this.panel.webview.postMessage({
             command: 'lastRecordedDate',
             date: getLastRecordedDate(this.globalState),
           });
           break;
         case 'openExternal':
           if (message.url) {
             await vscode.env.openExternal(vscode.Uri.parse(message.url));
           }
           break;
       }
     });
   }

   private async sendInitialState(): Promise<void> {
     this.panel.webview.postMessage({
       command: 'lastRecordedDate',
       date: getLastRecordedDate(this.globalState),
     });
     await this.loadAndSendData();
   }

   private async loadAndSendData(): Promise<void> {
     if (this.isLoading) {
       return;
     }
     this.isLoading = true;
     this.panel.webview.postMessage({ command: 'loading' });

     try {
       const { start, end } = this.getDateRange(this.currentDays);
       const summary = await this.collector.getSummaries(start, end);
       this.panel.webview.postMessage({
         command: 'update',
         days: this.currentDays,
         summary,
       });
       this.onDataUpdated?.(summary);
     } catch (error) {
       const message = error instanceof Error ? error.message : String(error);
       this.panel.webview.postMessage({ command: 'error', message });
     } finally {
       this.isLoading = false;
     }
   }

   private getDateRange(days: RangeDays): { start: Date; end: Date } {
     const end = new Date();
     const start = new Date();
     start.setDate(end.getDate() - (days - 1));
     start.setHours(0, 0, 0, 0);
     end.setHours(23, 59, 59, 999);
     return { start, end };
   }

   private getHtmlForWebview(extensionUri: vscode.Uri): string {
     const uplotJsUri = this.panel.webview.asWebviewUri(
       vscode.Uri.joinPath(extensionUri, 'media', 'uPlot.iife.min.js')
     );
     const uplotCssUri = this.panel.webview.asWebviewUri(
       vscode.Uri.joinPath(extensionUri, 'media', 'uPlot.min.css')
     );

     return `<!DOCTYPE html>
 <html lang="zh-CN">
 <head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${this.panel.webview.cspSource}; style-src 'unsafe-inline' ${this.panel.webview.cspSource}; img-src ${this.panel.webview.cspSource} blob:;">
   <title>CodePulse</title>
   <link rel="stylesheet" href="${uplotCssUri}">
   <style>
     :root {
       --bg: var(--vscode-editor-background, #1e1e1e);
       --fg: var(--vscode-editor-foreground, #cccccc);
       --border: var(--vscode-panel-border, #3c3c3c);
       --accent: var(--vscode-button-background, #0e639c);
       --accent-fg: var(--vscode-button-foreground, #ffffff);
     }
     * { box-sizing: border-box; }
     body {
       font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
       background: var(--bg);
       color: var(--fg);
       margin: 0;
       padding: 20px;
       line-height: 1.5;
     }
     .header {
       display: flex;
       justify-content: space-between;
       align-items: center;
       margin-bottom: 16px;
       gap: 16px;
       flex-wrap: wrap;
     }
     h1 { margin: 0; font-size: 20px; }
     .tabs {
       display: flex;
       gap: 4px;
     }
     .tab {
       padding: 6px 14px;
       border: 1px solid var(--border);
       background: transparent;
       color: var(--fg);
       cursor: pointer;
       border-radius: 4px;
       font-size: 13px;
     }
     .tab.active {
       background: var(--accent);
       color: var(--accent-fg);
       border-color: var(--accent);
     }
     .actions {
       display: flex;
       gap: 8px;
     }
     button {
       padding: 6px 14px;
       border: 1px solid var(--border);
       background: var(--accent);
       color: var(--accent-fg);
       cursor: pointer;
       border-radius: 4px;
       font-size: 13px;
     }
     button.secondary {
       background: transparent;
       color: var(--fg);
     }
     button:disabled {
       opacity: 0.5;
       cursor: not-allowed;
     }
     .record-marker {
       font-size: 12px;
       opacity: 0.8;
       margin-bottom: 16px;
     }
     .stats {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
       gap: 16px;
       margin-bottom: 24px;
     }
     .stat-card {
       border: 1px solid var(--border);
       border-radius: 6px;
       padding: 16px;
     }
     .stat-label {
       font-size: 12px;
       opacity: 0.8;
       margin-bottom: 4px;
     }
     .stat-value {
       font-size: 24px;
       font-weight: 600;
     }
     .section {
       border: 1px solid var(--border);
       border-radius: 6px;
       padding: 16px;
       margin-bottom: 20px;
     }
     .section-title {
       font-size: 14px;
       font-weight: 600;
       margin-bottom: 12px;
     }
     .project-list {
       display: flex;
       flex-direction: column;
       gap: 12px;
     }
     .project-item {
       display: grid;
       grid-template-columns: 1fr auto;
       gap: 12px;
       align-items: center;
     }
     .project-bar-bg {
       grid-column: 1 / -1;
       height: 6px;
       background: var(--border);
       border-radius: 3px;
       overflow: hidden;
     }
     .project-bar-fill {
       height: 100%;
       background: var(--accent);
       border-radius: 3px;
       transition: width 0.3s ease;
     }
     .project-name { font-size: 13px; }
     .project-time { font-size: 13px; opacity: 0.9; }
     .empty, .error, .loading {
       padding: 40px 20px;
       text-align: center;
       opacity: 0.8;
     }
     .error { color: var(--vscode-errorForeground, #f48771); }
     .wakatime-link {
       font-size: 12px;
       color: var(--vscode-textLink-foreground, #3794ff);
       text-decoration: none;
     }
     .wakatime-link:hover {
       text-decoration: underline;
     }
     .hidden { display: none !important; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>CodePulse</h1>
     <div class="tabs">
       <button class="tab active" data-days="7">7 天</button>
       <button class="tab" data-days="30">30 天</button>
       <button class="tab" data-days="90">90 天</button>
     </div>
     <div class="actions">
       <button id="markRecorded" class="secondary">同步完成</button>
       <button id="refresh">刷新</button>
     </div>
   </div>

   <div class="record-marker">
    <span id="lastRecorded">上次记录时间：未标记</span>
     <span style="margin-left: 16px;">
       <a class="wakatime-link" href="#" id="openWakaTime">打开 WakaTime ↗</a>
     </span>
   </div>

   <div id="content">
     <div class="loading">加载中…</div>
   </div>

   <script src="${uplotJsUri}"></script>
   <script>
     (function() {
       const vscode = acquireVsCodeApi();
       let currentDays = 7;
       let chart = null;

       const contentEl = document.getElementById('content');
       const tabEls = document.querySelectorAll('.tab');
       const refreshBtn = document.getElementById('refresh');
       const markRecordedBtn = document.getElementById('markRecorded');
       const lastRecordedEl = document.getElementById('lastRecorded');

       function formatDuration(seconds) {
         const hours = Math.floor(seconds / 3600);
         const mins = Math.floor((seconds % 3600) / 60);
         if (hours > 0) {
           return mins > 0 ? \`\${hours}h \${mins}m\` : \`\${hours}h\`;
         }
         return \`\${mins}m\`;
       }

      function updateLastRecordedDate(date) {
        if (date) {
          lastRecordedEl.textContent = \`上次记录时间：\${date}\`;
        } else {
          lastRecordedEl.textContent = '上次记录时间：未标记';
        }
      }

       function renderLoading() {
         contentEl.innerHTML = '<div class="loading">加载中…</div>';
         refreshBtn.disabled = true;
       }

       function renderError(message) {
         contentEl.innerHTML = \`<div class="error">加载失败：\${escapeHtml(message)}<br><button id="retryError" class="secondary" style="margin-top: 12px;">重试</button></div>\`;
         refreshBtn.disabled = false;
         const retryErrorBtn = document.getElementById('retryError');
         retryErrorBtn?.addEventListener('click', () => {
           vscode.postMessage({ command: 'refresh' });
         });
       }

       function renderEmpty() {
         contentEl.innerHTML = '<div class="empty">所选时间范围内暂无编码数据</div>';
         refreshBtn.disabled = false;
       }

       function escapeHtml(text) {
         const div = document.createElement('div');
         div.textContent = text;
         return div.innerHTML;
       }

       function renderSummary(days, summary) {
         refreshBtn.disabled = false;

         if (summary.totalSeconds === 0) {
           renderEmpty();
           return;
         }

         const statsHtml = \`
           <div class="stats">
             <div class="stat-card">
               <div class="stat-label">总时长</div>
               <div class="stat-value">\${formatDuration(summary.totalSeconds)}</div>
             </div>
             <div class="stat-card">
               <div class="stat-label">平均每天</div>
               <div class="stat-value">\${formatDuration(summary.dailyAverageSeconds)}</div>
             </div>
           </div>
         \`;

         const chartHtml = '<div class="section"><div class="section-title">每日趋势</div><div id="chart"></div></div>';

         const projectsHtml = summary.projects.length > 0
           ? \`
             <div class="section">
               <div class="section-title">项目视图</div>
               <div class="project-list">
                 \${summary.projects.map(p => \`
                   <div class="project-item">
                     <span class="project-name">\${escapeHtml(p.name)}</span>
                     <span class="project-time">\${formatDuration(p.totalSeconds)} (\${p.percent}%)</span>
                     <div class="project-bar-bg">
                       <div class="project-bar-fill" style="width: \${p.percent}%"></div>
                     </div>
                   </div>
                 \`).join('')}
               </div>
             </div>
           \`
           : '';

         contentEl.innerHTML = statsHtml + chartHtml + projectsHtml;

         renderChart(summary.days);
       }

       function renderChart(days) {
         if (!window.uPlot || days.length === 0) {
           return;
         }
         const chartEl = document.getElementById('chart');
         if (!chartEl) {
           return;
         }
         if (chart) {
           chart.destroy();
         }

         const timestamps = days.map(d => new Date(d.date + 'T00:00:00').getTime() / 1000);
         const values = days.map(d => d.totalSeconds / 3600);

         chart = new uPlot({
           width: chartEl.clientWidth,
           height: 220,
           axes: [
             { label: '日期', value: '{YYYY}-{MM}-{DD}' },
             { label: '小时' }
           ],
           series: [
             { label: '日期' },
             { label: '编码时长（小时）', stroke: 'var(--accent)', fill: 'rgba(14, 99, 156, 0.2)' }
           ],
           scales: { y: { auto: true } },
           cursor: { show: false }
         }, [timestamps, values], chartEl);
       }

       tabEls.forEach(tab => {
         tab.addEventListener('click', () => {
           const days = parseInt(tab.dataset.days, 10);
           currentDays = days;
           tabEls.forEach(t => t.classList.remove('active'));
           tab.classList.add('active');
           vscode.postMessage({ command: 'changeRange', days });
         });
       });

       refreshBtn.addEventListener('click', () => {
         vscode.postMessage({ command: 'refresh' });
       });

       markRecordedBtn.addEventListener('click', () => {
         vscode.postMessage({ command: 'markRecorded' });
       });

       const openWakaTimeLink = document.getElementById('openWakaTime');
       openWakaTimeLink?.addEventListener('click', (event) => {
         event.preventDefault();
         vscode.postMessage({ command: 'openExternal', url: 'https://wakatime.com/' });
       });

       window.addEventListener('message', event => {
         const message = event.data;
         switch (message.command) {
           case 'loading':
             renderLoading();
             break;
           case 'update':
             currentDays = message.days;
             renderSummary(message.days, message.summary);
             break;
           case 'error':
             renderError(message.message);
             break;
           case 'lastRecordedDate':
             updateLastRecordedDate(message.date);
             break;
         }
       });

       vscode.postMessage({ command: 'ready' });
     })();
   </script>
 </body>
 </html>`;
   }
 }
