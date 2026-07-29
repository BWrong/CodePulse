 import * as vscode from 'vscode';
 import { CodingSummary, ProjectDayDistribution, TimeCollector } from './models';
 import { getLastRecordedDate, markTodayAsRecorded } from './recordedDate';

 export type RangeDays = 7 | 30 | 90;

 export interface DashboardMessage {
   command: 'ready' | 'refresh' | 'changeRange' | 'markRecorded' | 'openExternal' | 'changeProjectDay' | 'clickProject';
   days?: RangeDays;
   projectDay?: string;
  projectName?: string;
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
  private currentProjectDate = new Date();
  private isLoadingProject = false;
  private distributionCache = new Map<string, ProjectDayDistribution>();
  private allTimeCache = new Map<string, number>();

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
           await this.loadAndSendData();
           break;
         case 'changeProjectDay':
           if (message.projectDay) {
             this.currentProjectDate = new Date(message.projectDay);
             await this.loadAndSendProjectDistribution();
           }
           break;
         case 'clickProject':
          if (message.projectName) {
            await this.loadProjectAllTime(message.projectName);
          }
          break;
        case 'openExternal':
           if (message.url) {
             await vscode.env.openExternal(vscode.Uri.parse(message.url));
           }
           break;
       }
     });
   }

     private async loadProjectAllTime(projectName: string): Promise<void> {
    const cached = this.allTimeCache.get(projectName);
    if (cached !== undefined) {
      this.panel.webview.postMessage({
        command: 'projectAllTime',
        projectName,
        totalSeconds: cached,
      });
      return;
    }
    this.panel.webview.postMessage({
      command: 'projectAllTimeLoading',
      projectName,
    });
    try {
      const result = await this.collector.getProjectAllTime(projectName);
      this.allTimeCache.set(projectName, result.totalSeconds);
      this.panel.webview.postMessage({
        command: 'projectAllTime',
        projectName,
        totalSeconds: result.totalSeconds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.panel.webview.postMessage({
        command: 'projectAllTimeError',
        projectName,
        message,
      });
    }
  }

  private formatProjectDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async loadAndSendProjectDistribution(): Promise<void> {
    if (this.isLoadingProject) {
      return;
    }
    const key = this.formatProjectDateKey(this.currentProjectDate);
    const cached = this.distributionCache.get(key);
    if (cached) {
      this.panel.webview.postMessage({
        command: 'projectDistribution',
        distribution: cached,
        projectDay: key,
        cached: true,
      });
      return;
    }
    this.isLoadingProject = true;
    this.panel.webview.postMessage({
      command: 'projectDistributionLoading',
      projectDay: key,
    });
    try {
      const distribution = await this.collector.getDistributionByDate(
        this.currentProjectDate
      );
      this.distributionCache.set(key, distribution);
      this.panel.webview.postMessage({
        command: 'projectDistribution',
        distribution,
        projectDay: key,
        cached: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.panel.webview.postMessage({
        command: 'projectDistributionError',
        projectDay: key,
        message,
      });
    } finally {
      this.isLoadingProject = false;
    }
  }

private async sendInitialState(): Promise<void> {
     await this.loadAndSendData();
    await this.loadAndSendProjectDistribution();
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
         lastRecordedDate: getLastRecordedDate(this.globalState),
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
    const minProjectMinutes = vscode.workspace.getConfiguration('codepulse').get<number>('minProjectDurationMinutes', 5);
    const minProjectSeconds = Math.max(0, Math.round(minProjectMinutes * 60));
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
      --muted: var(--vscode-descriptionForeground, #9ca3af);
      --border: var(--vscode-panel-border, #3c3c3c);
      --accent: var(--vscode-button-background, #0e639c);
      --accent-fg: var(--vscode-button-foreground, #ffffff);
      --accent-hover: var(--vscode-button-hoverBackground, #1177bb);
      --card-bg: var(--vscode-editor-inactiveSelectionBackground, rgba(173, 173, 173, 0.1));
      --error: var(--vscode-errorForeground, #f48771);
      --link: var(--vscode-textLink-foreground, #3794ff);
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--font-family);
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
    h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .tabs {
      display: flex;
      gap: 4px;
    }
    .tab {
      padding: 6px 14px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      border-radius: 4px;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    .tab:hover {
      color: var(--fg);
      border-color: var(--accent);
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
      transition: background 0.2s ease;
    }
    button:hover {
      background: var(--accent-hover);
    }
    button.secondary {
      background: transparent;
      color: var(--fg);
    }
    button.secondary:hover {
      background: var(--card-bg);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .stat-card:hover {
      border-color: var(--accent);
      transform: translateY(-1px);
    }
    .stat-label {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.2;
    }
    .stat-sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--fg);
    }
    .project-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .project-item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px 12px;
      align-items: center;
    }
    .project-bar-bg {
      grid-column: 1 / -1;
      height: 8px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0;
      overflow: hidden;
    }
    .project-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3794ff 0%, #2196f3 100%);
      border-radius: 3px;
      transition: width 0.4s ease;
      min-width: 2px;
      box-shadow: 0 0 0 1px rgba(55, 148, 255, 0.3);
    }
    .project-name {
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .project-name:hover {
      color: var(--link);
    }
    .project-popover {
      position: fixed;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 500;
      color: var(--fg);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      z-index: 200;
      pointer-events: none;
      white-space: nowrap;
    }
    .project-time {
      font-size: 13px;
      color: var(--muted);
      text-align: right;
    }
    .empty, .error, .loading {
      padding: 40px 20px;
      text-align: center;
      color: var(--muted);
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .loading::before {
      content: '';
      width: 16px;
      height: 16px;
      border: 2px solid var(--border);
      border-top-color: #3794ff;
      border-radius: 50%;
      animation: cp-spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    @keyframes cp-spin {
      to { transform: rotate(360deg); }
    }
    .error { color: var(--error); }
    .hidden { display: none !important; }

    .unrecorded-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      align-items: flex-start;
    }
    .unrecorded-main {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 160px;
      flex: 0 0 auto;
    }
    .unrecorded-label {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .unrecorded-total {
      font-size: 32px;
      font-weight: 600;
      line-height: 1.2;
    }
    .unrecorded-sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 6px;
    }
    .unrecorded-list {
      flex: 1 1 300px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 280px;
    }
    .unrecorded-empty {
      color: var(--muted);
      font-size: 13px;
      padding: 12px 0;
    }

    .info-icon {
      display: inline-flex;
      align-items: center;
      margin-left: 4px;
      color: var(--muted);
      cursor: help;
      vertical-align: middle;
      opacity: 0.7;
      position: relative;
    }
    .info-icon:hover {
      opacity: 1;
    }
    .info-icon::after {
      content: attr(data-tip);
      position: absolute;
      bottom: 125%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--vscode-editorHoverWidget-background, #333);
      color: var(--vscode-editorHoverWidget-foreground, #fff);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }
    .info-icon:hover::after {
      opacity: 1;
    }

    /* uPlot customizations */
    .chart-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    #chart {
      width: 100%;
      min-height: 220px;
    }
    .uplot-tooltip {
      position: absolute;
      z-index: 100;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
      color: var(--fg);
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 280px;
    }
    .uplot-tooltip-title {
      font-weight: 600;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
      color: var(--fg);
    }
    .uplot-tooltip-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin: 3px 0;
    }
    .uplot-tooltip-row.total {
      font-weight: 600;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--border);
    }
    .uplot-tooltip-label {
      color: var(--muted);
    }
    .uplot-tooltip-value {
      color: var(--fg);
      white-space: nowrap;
    }
    .u-axis, .u-label, .u-value, .u-axis text, .u-label text, text { fill: #6a6a6a !important; color: #6a6a6a !important; }
    .u-title { display: none !important; }
    .u-legend { display: none !important; }
    .u-select { background: rgba(55, 148, 255, 0.1) !important; }

    /* Project distribution section */
    .distribution-section { padding: 0; }
    .distribution-header-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--fg);
    }
    .distribution-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
      font-size: 14px;
    }
    .distribution-nav-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .distribution-nav {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 4px;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      font-size: 14px;
    }
    .distribution-nav:hover:not(:disabled) {
      color: var(--fg);
      border-color: var(--accent);
    }
    .distribution-nav:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .distribution-total {
      font-size: 18px;
      font-weight: 600;
    }
    .distribution-date {
      color: var(--muted);
      font-size: 13px;
    }
    .distribution-axis {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px;
      align-items: center;
      margin-bottom: 4px;
      font-size: 11px;
      color: var(--muted);
    }
    .distribution-axis-ticks {
      position: relative;
      height: 16px;
    }
    .distribution-axis-tick {
      position: absolute;
      transform: translateX(-50%);
      white-space: nowrap;
    }
    .distribution-rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .distribution-row {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px;
      align-items: center;
      height: 28px;
    }
    .distribution-row:hover {
      background: rgba(173, 173, 173, 0.05);
      border-radius: 4px;
    }
    .distribution-row-label {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
      overflow: hidden;
    }
    .distribution-row-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .distribution-row-time {
      color: var(--muted);
      flex-shrink: 0;
    }
    .distribution-row-track {
      position: relative;
      height: 14px;
      background: rgba(128, 128, 128, 0.05);
      border: 1px solid var(--border);
      border-radius: 3px;
      overflow: hidden;
    }
    .distribution-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      background: linear-gradient(90deg, #3794ff 0%, #2196f3 100%);
      border-radius: 0;
      cursor: help;
      min-width: 2px;
      box-shadow: 0 0 0 1px rgba(55, 148, 255, 0.3);
    }
    .distribution-row[data-weak="1"] .distribution-bar {
      opacity: 0.55;
    }
    .distribution-tooltip {
      position: absolute;
      z-index: 100;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--fg);
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 240px;
    }
    .distribution-tooltip-title {
      font-weight: 600;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }
    .distribution-tooltip-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin: 2px 0;
      color: var(--muted);
    }
    .distribution-tooltip-row strong { color: var(--fg); }
    .distribution-empty, .distribution-error, .distribution-loading-state {
      padding: 24px 12px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
    }
    .distribution-error { color: var(--error); }
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
      <button id="markRecorded" class="secondary">记录完成</button>
      <button id="openWakaTime" class="secondary">WakaTime</button>
      <button id="refresh">刷新</button>
    </div>
  </div>

  <div id="content">
    <div class="loading">加载中…</div>
  </div>

  <script src="${uplotJsUri}"></script>
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const MIN_PROJECT_SECONDS = ${minProjectSeconds};
      let currentDays = 7;
      let chart = null;
      let chartResizeHandler = null;
      let currentLastRecordedDate = null;
      let lastSummary = null;

      const contentEl = document.getElementById('content');
      const tabEls = document.querySelectorAll('.tab');
      const refreshBtn = document.getElementById('refresh');
      const markRecordedBtn = document.getElementById('markRecorded');

      function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
          return mins > 0 ? \`\${hours}h \${mins}m\` : \`\${hours}h\`;
        }
        return \`\${mins}m\`;
      }

      function formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return \`\${year}-\${month}-\${day}\`;
      }

      function getTodaySeconds(days) {
        if (!days || days.length === 0) return 0;
        const today = formatLocalDate(new Date());
        const found = days.find(d => d.date === today);
        return found ? found.totalSeconds : 0;
      }

      function getMostActiveDay(days) {
        if (!days || days.length === 0) return null;
        return days.reduce((max, day) => (day.totalSeconds > max.totalSeconds ? day : max), days[0]);
      }

     function getUnrecordedProjects(summary, lastRecordedDate) {
        if (!summary || !summary.days) {
          return null;
        }
        if (!lastRecordedDate) {
          return null;
        }
        const recordedDate = lastRecordedDate.slice(0, 10);
        const unrecordedDays = summary.days.filter(d => d.date >= recordedDate);
       if (unrecordedDays.length === 0) {
         return { totalSeconds: 0, projects: [] };
       }

        const projectMap = new Map();
        let totalSeconds = 0;
        for (const day of unrecordedDays) {
          totalSeconds += day.totalSeconds;
          for (const project of day.projects || []) {
            const current = projectMap.get(project.name) ?? 0;
            projectMap.set(project.name, current + project.totalSeconds);
          }
        }

        const projects = Array.from(projectMap.entries())
          .map(([name, projectSeconds]) => ({
            name,
            totalSeconds: projectSeconds,
            percent: totalSeconds > 0 ? Math.round((projectSeconds / totalSeconds) * 100 * 100) / 100 : 0,
          }))
          .sort((a, b) => b.totalSeconds - a.totalSeconds);

        return { totalSeconds, projects };
      }

      function updateLastRecordedDate(date) {
        currentLastRecordedDate = date ?? null;
      }

      function filterProjectsByMinDuration(projects, minSeconds) {
        const filtered = (projects || []).filter(p => p.totalSeconds >= minSeconds);
        const totalSeconds = filtered.reduce((sum, p) => sum + p.totalSeconds, 0);
        return filtered.map(p => ({
          ...p,
          percent: totalSeconds > 0 ? Math.round((p.totalSeconds / totalSeconds) * 100 * 100) / 100 : 0,
        }));
      }

      function computeUnrecorded(summary, lastRecordedDate) {
        const unrecorded = getUnrecordedProjects(summary, lastRecordedDate);
        if (!unrecorded) {
          return null;
        }
        unrecorded.projects = filterProjectsByMinDuration(unrecorded.projects, MIN_PROJECT_SECONDS);
        unrecorded.totalSeconds = unrecorded.projects.reduce((sum, p) => sum + p.totalSeconds, 0);
        return unrecorded;
      }

      function getDataEndDate(lastRecordedDate) {
        if (!lastRecordedDate) {
          return null;
        }
        const d = new Date(lastRecordedDate.slice(0, 10) + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
      }

      function updateUnrecordedOnly() {
        if (!lastSummary) {
          return;
        }
        const wrapper = document.getElementById('unrecorded-wrapper');
        if (!wrapper) {
          return;
        }
        wrapper.innerHTML = renderUnrecordedSection(computeUnrecorded(lastSummary, currentLastRecordedDate));
      }

      function dayFilteredSeconds(day) {
        return (day.projects || []).filter(p => p.totalSeconds >= MIN_PROJECT_SECONDS).reduce((sum, p) => sum + p.totalSeconds, 0);
      }

      function renderLoading() {
        if (document.getElementById('stats-section')) {
          document.getElementById('stats-section').innerHTML = '<div class="loading">加载中…</div>';
          refreshBtn.disabled = true;
        } else {
          contentEl.innerHTML = '<div class="loading">加载中…</div>';
          refreshBtn.disabled = true;
        }
      }

      function renderError(message) {
        contentEl.innerHTML = \`<div class="error">加载失败：\${escapeHtml(message)}<br><button id="retryError" class="secondary" style="margin-top: 12px;">重试</button></div>\`;
        refreshBtn.disabled = false;
        const retryErrorBtn = document.getElementById('retryError');
        retryErrorBtn?.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
      }

      function ensureContentStructure() {
        if (document.getElementById('stats-section')) return;
        contentEl.innerHTML =
          '<div id="stats-section"></div>' +
          '<div id="unrecorded-wrapper"></div>' +
          '<div class="section"><div class="chart-title-row"><span class="section-title" style="margin-bottom:0">每日趋势</span><button id="resetChart" class="secondary" style="padding:2px 10px;font-size:12px;">重置</button></div><div id="chart"></div></div>' +
          '<div class="section"><div id="distributionSection"><div class="distribution-loading-state">加载中…</div></div></div>' +
          '<div id="projects-section"></div>';
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

        const todaySeconds = getTodaySeconds(summary.days);
        const filteredProjects = filterProjectsByMinDuration(summary.projects, MIN_PROJECT_SECONDS);
        lastSummary = summary;
        const mostActive = getMostActiveDay(summary.days);

        const statsHtml = \`
          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">总时长</div>
              <div class="stat-value">\${formatDuration(summary.totalSeconds)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">今天</div>
              <div class="stat-value">\${formatDuration(todaySeconds)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">每天</div>
              <div class="stat-value">\${formatDuration(summary.dailyAverageSeconds)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">最活跃</div>
              <div class="stat-value">\${mostActive ? formatDuration(mostActive.totalSeconds) : '0m'}</div>
              <div class="stat-sub">\${mostActive ? escapeHtml(mostActive.date) : '暂无数据'}</div>
            </div>
          </div>
        \`;

        const unrecorded = computeUnrecorded(summary, currentLastRecordedDate);
        const unrecordedHtml = renderUnrecordedSection(unrecorded);

        const projectsHtml = filteredProjects.length > 0
          ? \`
            <div class="section">
              <div class="section-title">项目视图</div>
              <div class="project-list">
                \${filteredProjects.map(p => \`
                  <div class="project-item">
                    <span class="project-name" data-project="\${escapeHtml(p.name)}">\${escapeHtml(p.name)}</span>
                    <span class="project-time">\${formatDuration(p.totalSeconds)} (\${p.percent}%)</span>
                    <div class="project-bar-bg">
                      <div class="project-bar-fill" style="width: \${Math.max(p.percent, 0.5)}%"></div>
                    </div>
                  </div>
                \`).join('')}
              </div>
            </div>
          \`
          : '';

        ensureContentStructure();
        document.getElementById('stats-section').innerHTML = statsHtml;
        document.getElementById('unrecorded-wrapper').innerHTML = unrecordedHtml;
        document.getElementById('projects-section').innerHTML = projectsHtml;

        renderChart(summary.days);
        attachProjectNameHandlers();
      }

      function renderUnrecordedSection(unrecorded) {
        if (!unrecorded) {
          return \`
            <div class="unrecorded-section">
              <div class="unrecorded-main">
                <div class="unrecorded-label">未记录项目</div>
                <div class="unrecorded-empty">尚未记录过，点击顶部"记录完成"按钮开始</div>
              </div>
            </div>
          \`;
        }

        if (unrecorded.totalSeconds === 0) {
          return \`
            <div class="unrecorded-section">
              <div class="unrecorded-main">
                <div class="unrecorded-label">未记录项目<span class="info-icon" data-tip="数据截止时间：\${getDataEndDate(currentLastRecordedDate) || '无'}">ⓘ</span></div>
               <div class="unrecorded-total">0m</div>
                <div class="unrecorded-sub">\${currentLastRecordedDate ? \`上次记录时间：\${escapeHtml(currentLastRecordedDate)}\` : '尚未记录过，点击顶部“记录完成”按钮开始'}</div>
             </div>
              <div class="unrecorded-list">
                <div class="unrecorded-empty">暂无未记录时长</div>
              </div>
            </div>
          \`;
        }

        const listHtml = unrecorded.projects.map(p => \`
          <div class="project-item">
            <span class="project-name">\${escapeHtml(p.name)}</span>
            <span class="project-time">\${formatDuration(p.totalSeconds)} (\${p.percent}%)</span>
            <div class="project-bar-bg">
              <div class="project-bar-fill" style="width: \${Math.max(p.percent, 0.5)}%"></div>
            </div>
          </div>
        \`).join('');

        return \`
          <div class="unrecorded-section">
            <div class="unrecorded-main">
              <div class="unrecorded-label">未记录项目<span class="info-icon" data-tip="数据截止时间：\${getDataEndDate(currentLastRecordedDate) || '无'}">ⓘ</span></div>
             <div class="unrecorded-total">\${formatDuration(unrecorded.totalSeconds)}</div>
              <div class="unrecorded-sub">\${currentLastRecordedDate ? \`上次记录时间：\${escapeHtml(currentLastRecordedDate)}\` : '尚未记录过，点击顶部“记录完成”按钮开始'}</div>
           </div>
            <div class="unrecorded-list">
              \${listHtml}
            </div>
          </div>
        \`;
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
          if (chartResizeHandler) {
            window.removeEventListener('resize', chartResizeHandler);
            chartResizeHandler = null;
          }
          chart.destroy();
        }

        const timestamps = days.map(d => new Date(d.date + 'T00:00:00').getTime() / 1000);
        const values = days.map(d => dayFilteredSeconds(d) / 3600);

        // Remove existing tooltip if any
        const oldTooltip = document.querySelector('.uplot-tooltip');
        if (oldTooltip) oldTooltip.remove();

        const tooltip = document.createElement('div');
        tooltip.className = 'uplot-tooltip hidden';
        document.body.appendChild(tooltip);

        chart = new uPlot({
          width: chartEl.clientWidth,
          height: 240,
          axes: [
            {
              labelSize: 0,
              stroke: '#6a6a6a',
              space: function(u, idx, min, max, dim) {
                var daySec = 86400;
                var totalDays = (max - min) / daySec;
                return Math.max(dim / totalDays, 50);
              },
              values: [
                [3600 * 24 * 7, '{MM}-{DD}'],
                [3600 * 24, '{MM}-{DD}'],
              ],
            },
            {
              labelSize: 0,
              stroke: '#6a6a6a',
              values: (u, splits) => splits.map(v => v.toFixed(1)),
            }
          ],
          series: [
            {},
            {
              stroke: '#3794ff',
              fill: 'rgba(55, 148, 255, 0.2)',
              width: 2,
              spline: true,
            }
          ],
          scales: { y: { auto: true } },
          cursor: {
            show: true,
            focus: { prox: 16 },
            y: false,
          },
          hooks: {
            setCursor: [
              (u) => {
                const idx = u.cursor.idx;
                if (idx == null || idx < 0 || idx >= days.length) {
                  tooltip.classList.add('hidden');
                  return;
                }
                const day = days[idx];
                const projectRows = (day.projects || [])
                  .filter(p => p.totalSeconds >= 60)
                  .sort((a, b) => b.totalSeconds - a.totalSeconds)
                  .map(p => \`
                    <div class="uplot-tooltip-row">
                      <span class="uplot-tooltip-label">\${escapeHtml(p.name)}</span>
                      <span class="uplot-tooltip-value">\${formatDuration(p.totalSeconds)}</span>
                    </div>
                  \`).join('');

                tooltip.innerHTML = \`
                  <div class="uplot-tooltip-title">\${day.date}</div>
                  \${projectRows}
                  <div class="uplot-tooltip-row total">
                    <span class="uplot-tooltip-label">合计</span>
                    <span class="uplot-tooltip-value">\${formatDuration(dayFilteredSeconds(day))}</span>
                  </div>
                \`;

                const rect = chartEl.getBoundingClientRect();
                const left = rect.left + u.cursor.left + 12;
                const top = rect.top + u.cursor.top + 12;
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
                tooltip.classList.remove('hidden');
              }
            ],
            setScale: [
              () => {
                tooltip.classList.add('hidden');
              }
            ]
          }
        }, [timestamps, values], chartEl);

        chartResizeHandler = () => {
          if (chart) {
            chart.setSize({ width: chartEl.clientWidth, height: 240 });
          }
        };
        window.addEventListener('resize', chartResizeHandler);

        chartEl.addEventListener('mouseleave', () => {
          tooltip.classList.add('hidden');
        });

        var resetBtn = document.getElementById('resetChart');
        if (resetBtn) {
          resetBtn.onclick = function() {
            if (chart && timestamps.length > 0) {
              chart.setScale('x', { min: timestamps[0], max: timestamps[timestamps.length - 1] });
            }
          };
        }
      }


      var activePopoverProject = null;
      var popoverEl = null;

      function showProjectPopover(name, anchorEl) {
        hideProjectPopover();
        activePopoverProject = name;
        popoverEl = document.createElement('div');
        popoverEl.className = 'project-popover';
        popoverEl.textContent = '...';
        document.body.appendChild(popoverEl);
        var rect = anchorEl.getBoundingClientRect();
        popoverEl.style.left = rect.left + 'px';
        popoverEl.style.top = (rect.bottom + 8) + 'px';
      }

      function hideProjectPopover() {
        if (popoverEl) {
          popoverEl.remove();
          popoverEl = null;
        }
        activePopoverProject = null;
      }

      function attachProjectNameHandlers() {
        var names = document.querySelectorAll('.project-name[data-project]');
        names.forEach(function(el) {
          el.onclick = function(e) {
            e.stopPropagation();
            var name = el.getAttribute('data-project');
            if (!name) return;
            showProjectPopover(name, el);
            vscode.postMessage({ command: 'clickProject', projectName: name });
          };
        });
        document.onclick = function() {
          hideProjectPopover();
        };
      }

      function pad2(n) { return String(n).padStart(2, '0'); }

      function formatDateKey(date) {
        return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
      }

      function parseDateKey(key) {
        const parts = key.split('-').map(s => parseInt(s, 10));
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }

      function addDays(date, n) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() + n);
        return d;
      }

      function formatHHMM(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      }

      function computeBarSegments(bucket) {
        const segments = [];
        for (const session of bucket.sessions || []) {
          const s = new Date(session.start);
          const e = new Date(session.end);
          if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e.getTime() <= s.getTime()) {
            continue;
          }
          const dayStart = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
          const sessionStartMs = s.getTime() - dayStart;
          const sessionEndMs = e.getTime() - dayStart;
          const hourStartMs = bucket.hour * 3600 * 1000;
          const hourEndMs = hourStartMs + 3600 * 1000;
          const sliceStart = Math.max(sessionStartMs, hourStartMs);
          const sliceEnd = Math.min(sessionEndMs, hourEndMs);
          if (sliceEnd <= sliceStart) continue;
          const left = (sliceStart / (24 * 3600 * 1000)) * 100;
          const width = ((sliceEnd - sliceStart) / (24 * 3600 * 1000)) * 100;
          var sliceStartIso = new Date(dayStart + sliceStart).toISOString();
          var sliceEndIso = new Date(dayStart + sliceEnd).toISOString();
          segments.push({ left: left, width: width, sliceStartIso: sliceStartIso, sliceEndIso: sliceEndIso });
        }
        return segments;
      }

      function buildAxisTicks() {
        const ticks = [];
        for (let h = 0; h <= 24; h += 2) {
          ticks.push({ hour: h, label: pad2(h) });
        }
        return ticks;
      }

      function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
          return mins > 0 ? hours + 'h ' + mins + 'm' : hours + 'h';
        }
        return mins + 'm';
      }

      function renderDistributionHeader(distribution, projectDay) {
        var todayKey = formatDateKey(new Date());
        var isToday = projectDay === todayKey;
        var totalLabel = formatDuration(distribution.totalSeconds || 0);
        var dateLabel = projectDay + (isToday ? ' (Today)' : '');
        return '<div class="distribution-header">' +
          '<span class="distribution-header-title">时段分布</span>' +
          '<div class="distribution-nav-group">' +
          '<span class="distribution-total">' + totalLabel + '</span>' +
          '<button class="distribution-nav" id="distributionPrev">‹</button>' +
          '<span class="distribution-date">' + dateLabel + '</span>' +
          '<button class="distribution-nav" id="distributionNext"' + (isToday ? ' disabled' : '') + '>›</button>' +
          '</div>' +
          '</div>';
      }

      function renderDistributionBody(distribution) {
        var projects = (distribution.projects || []).filter(function(p) { return p.totalSeconds >= 60; });
        if (projects.length === 0) {
          return '<div class="distribution-empty">所选日期暂无编码记录</div>';
        }
        var axisTicks = buildAxisTicks();
        var axisHtml = axisTicks.map(function(t) {
          var left = (t.hour / 24) * 100;
          return '<span class="distribution-axis-tick" style="left: ' + left + '%;">' + t.label + '</span>';
        }).join('');
        var isWeakProject = function(p) { return p.totalSeconds > 0 && p.totalSeconds < 60; };
        var rowsHtml = projects.map(function(p) {
          var weak = isWeakProject(p) ? '1' : '0';
          var segments = [];
          for (var i = 0; i < p.buckets.length; i++) {
            var bucket = p.buckets[i];
            var segs = computeBarSegments(bucket);
            for (var j = 0; j < segs.length; j++) {
              segments.push({ hour: bucket.hour, left: segs[j].left, width: segs[j].width, sliceStartIso: segs[j].sliceStartIso, sliceEndIso: segs[j].sliceEndIso });
            }
          }
          var barsHtml = segments.map(function(seg) {
            var leftPct = seg.left.toFixed(3);
            var widthPct = Math.max(seg.width, 0.4).toFixed(3);
            return '<div class="distribution-bar" style="left: ' + leftPct + '%; width: ' + widthPct + '%;" data-project="' + escapeHtml(p.name) + '" data-slice-start="' + seg.sliceStartIso + '" data-slice-end="' + seg.sliceEndIso + '" data-project-time="' + formatDuration(p.totalSeconds) + '"></div>';
          }).join('');
          return '<div class="distribution-row" data-weak="' + weak + '">' +
            '<div class="distribution-row-label"><span class="distribution-row-name">' + escapeHtml(p.name) + '</span><span class="distribution-row-time">' + formatDuration(p.totalSeconds) + '</span></div>' +
            '<div class="distribution-row-track">' + barsHtml + '</div>' +
            '</div>';
        }).join('');
        return '<div class="distribution-axis"><div></div><div class="distribution-axis-ticks">' + axisHtml + '</div></div>' +
          '<div class="distribution-rows">' + rowsHtml + '</div>';
      }

      function setDistributionSection(html) {
        var el = document.getElementById('distributionSection');
        if (el) { el.innerHTML = html; }
      }

      function getDistributionSection() {
        return document.getElementById('distributionSection');
      }

      function getCurrentProjectDay() {
        var el = getDistributionSection();
        if (!el) return null;
        var dateEl = el.querySelector('.distribution-date');
        if (!dateEl) return null;
        var text = dateEl.textContent || '';
        if (text.indexOf('(Today)') >= 0) {
          return text.replace('(Today)', '').trim();
        }
        return text.trim();
      }

      function projectDayStartMs(hour) {
        var key = getCurrentProjectDay();
        if (!key) return 0;
        var d = parseDateKey(key);
        d.setHours(hour, 0, 0, 0);
        return d.getTime();
      }

      function attachDistributionNavHandlers() {
        var prevBtn = document.getElementById('distributionPrev');
        var nextBtn = document.getElementById('distributionNext');
        if (prevBtn) {
          prevBtn.addEventListener('click', function() {
            var current = getCurrentProjectDay();
            if (!current) return;
            var target = addDays(parseDateKey(current), -1);
            vscode.postMessage({ command: 'changeProjectDay', projectDay: formatDateKey(target) });
          });
        }
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.addEventListener('click', function() {
            var current = getCurrentProjectDay();
            if (!current) return;
            var target = addDays(parseDateKey(current), 1);
            vscode.postMessage({ command: 'changeProjectDay', projectDay: formatDateKey(target) });
          });
        }
      }

      function attachDistributionHoverHandlers() {
        var container = getDistributionSection();
        if (!container) return;
        var tooltip = container.querySelector('.distribution-tooltip');
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.className = 'distribution-tooltip hidden';
          container.style.position = container.style.position || 'relative';
          container.appendChild(tooltip);
        }
        var bars = container.querySelectorAll('.distribution-bar');
        bars.forEach(function(bar) {
          bar.addEventListener('mouseenter', function(event) {
            var target = event.currentTarget;
            var project = target.getAttribute('data-project') || '';
            var sliceStartIso = target.getAttribute('data-slice-start') || '';
            var sliceEndIso = target.getAttribute('data-slice-end') || '';
            var projectTime = target.getAttribute('data-project-time') || '';
            var startLabel = formatHHMM(sliceStartIso);
            var endLabel = formatHHMM(sliceEndIso);
            var startMs = new Date(sliceStartIso).getTime();
            var endMs = new Date(sliceEndIso).getTime();
            var minutes = Math.max(0, Math.round((endMs - startMs) / 60000));
            tooltip.innerHTML = '<div class="distribution-tooltip-title">' + escapeHtml(project) + '</div>' +
              '<div class="distribution-tooltip-row"><span>' + startLabel + ' - ' + endLabel + '</span><strong>' + minutes + 'm</strong></div>' +
              '<div class="distribution-tooltip-row"><span>当日累计</span><strong>' + escapeHtml(projectTime) + '</strong></div>';
            tooltip.classList.remove('hidden');
            var rect = target.getBoundingClientRect();
            var containerRect = container.getBoundingClientRect();
            var left = rect.left - containerRect.left;
            var top = rect.top - containerRect.top - tooltip.offsetHeight - 6;
            tooltip.style.left = Math.max(4, left) + 'px';
            tooltip.style.top = Math.max(4, top) + 'px';
          });
          bar.addEventListener('mouseleave', function() {
            tooltip.classList.add('hidden');
          });
        });
      }

      function updateDistributionSection(distribution, projectDay) {
        var section = document.getElementById('distributionSection');
        if (!section) return;
        var body = section.querySelector('.distribution-body');
        if (!body) {
          section.innerHTML = '<div class="distribution-section">' +
            renderDistributionHeader(distribution, projectDay) +
            '<div class="distribution-body">' + renderDistributionBody(distribution) + '</div>' +
            '</div>';
        } else {
          var header = section.querySelector('.distribution-header');
          if (header) {
            header.outerHTML = renderDistributionHeader(distribution, projectDay);
          }
          body.innerHTML = renderDistributionBody(distribution);
        }
        attachDistributionNavHandlers();
        attachDistributionHoverHandlers();
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
            if (message.lastRecordedDate !== undefined) {
              updateLastRecordedDate(message.lastRecordedDate);
            }
            renderSummary(message.days, message.summary);
            break;
          case 'recordedUpdated':
            if (message.lastRecordedDate !== undefined) {
              updateLastRecordedDate(message.lastRecordedDate);
            }
            updateUnrecordedOnly();
            break;
          case 'projectDistributionLoading':
            setDistributionSection('<div class="distribution-loading-state">加载中…</div>');
            break;
          case 'projectDistribution':
            updateDistributionSection(message.distribution, message.projectDay);
            break;
          case 'projectDistributionError':
            setDistributionSection('<div class="distribution-error">加载失败：' + escapeHtml(message.message || '未知错误') + '</div>');
            break;
          case 'projectAllTimeLoading':
            if (activePopoverProject === message.projectName && popoverEl) {
              popoverEl.textContent = '...';
            }
            break;
          case 'projectAllTime':
            if (activePopoverProject === message.projectName && popoverEl) {
              popoverEl.textContent = '总计 ' + formatDuration(message.totalSeconds);
            }
            break;
          case 'projectAllTimeError':
            if (activePopoverProject === message.projectName && popoverEl) {
              popoverEl.textContent = '获取失败';
            }
            break;
          case 'error':
            renderError(message.message);
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
