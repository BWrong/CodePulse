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
    .record-marker {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
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
      border-radius: 4px;
      overflow: hidden;
    }
    .project-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%);
      border-radius: 3px;
      transition: width 0.4s ease;
      min-width: 2px;
      box-shadow: 0 0 0 1px var(--accent-hover), 0 0 6px 0 var(--accent-hover);
    }
    .project-name {
      font-size: 13px;
      font-weight: 500;
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
    .error { color: var(--error); }
    .wakatime-link {
      font-size: 12px;
      color: var(--link);
      text-decoration: none;
    }
    .wakatime-link:hover {
      text-decoration: underline;
    }
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

    /* uPlot customizations */
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
    .u-axis { color: var(--muted) !important; }
    .u-label { color: var(--muted) !important; }
    .u-title { display: none !important; }
    .u-legend { display: none !important; }
    .u-select { background: rgba(14, 99, 156, 0.1) !important; }
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
      <button id="refresh">刷新</button>
    </div>
  </div>

  <div class="record-marker">
    <span id="lastRecorded">上次记录时间：未标记</span>
    <span>
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
      let chartResizeHandler = null;
      let currentLastRecordedDate = null;

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

      function getMostActiveProject(projects) {
        if (!projects || projects.length === 0) return null;
        return projects[0];
      }

      function getUnrecordedProjects(summary, lastRecordedDate) {
        if (!lastRecordedDate || !summary || !summary.days) {
          return null;
        }
        const recordedDate = lastRecordedDate.slice(0, 10);
        const unrecordedDays = summary.days.filter(d => d.date > recordedDate);
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

        const todaySeconds = getTodaySeconds(summary.days);
        const mostActive = getMostActiveProject(summary.projects);

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
              <div class="stat-sub">\${mostActive ? escapeHtml(mostActive.name) : '暂无项目'}</div>
            </div>
          </div>
        \`;

        const unrecorded = getUnrecordedProjects(summary, currentLastRecordedDate);
        const unrecordedHtml = renderUnrecordedSection(unrecorded);

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
                      <div class="project-bar-fill" style="width: \${Math.max(p.percent, 0.5)}%"></div>
                    </div>
                  </div>
                \`).join('')}
              </div>
            </div>
          \`
          : '';

        contentEl.innerHTML = statsHtml + unrecordedHtml + chartHtml + projectsHtml;

        renderChart(summary.days);
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
                <div class="unrecorded-label">未记录项目</div>
                <div class="unrecorded-total">0m</div>
                <div class="unrecorded-sub">上次记录时间：\${escapeHtml(currentLastRecordedDate)}</div>
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
              <div class="unrecorded-label">未记录项目</div>
              <div class="unrecorded-total">\${formatDuration(unrecorded.totalSeconds)}</div>
              <div class="unrecorded-sub">上次记录时间：\${escapeHtml(currentLastRecordedDate)}</div>
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
        const values = days.map(d => d.totalSeconds / 3600);

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
              values: [
                [3600 * 24 * 7, '{MM}-{DD}'],
                [3600 * 24, '{MM}-{DD}'],
              ],
            },
            {
              labelSize: 0,
              values: (u, splits) => splits.map(v => v.toFixed(1)),
            }
          ],
          series: [
            {},
            {
              stroke: 'var(--accent)',
              fill: 'rgba(14, 99, 156, 0.35)',
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
                  .filter(p => p.totalSeconds > 0)
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
                    <span class="uplot-tooltip-value">\${formatDuration(day.totalSeconds)}</span>
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
            chart.setSize(chartEl.clientWidth, 240);
          }
        };
        window.addEventListener('resize', chartResizeHandler);

        chartEl.addEventListener('mouseleave', () => {
          tooltip.classList.add('hidden');
        });
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