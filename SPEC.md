 # CodePulse Spec

 ## Problem Statement

 The user wants to track their own coding time inside VS Code, aggregated by project, over 7/30/90-day windows. The primary goal is to support project cost accounting: the user periodically copies project totals into a Tencent Docs spreadsheet that tracks per-member hours. Existing solutions like WakaTime do not integrate with Tencent Docs, so the user needs a custom VS Code extension that:

 - Shows total coding time, daily average, a trend chart, and a project breakdown for the selected time window.
 - Provides a lightweight "manual bookkeeping aid" that records the last day the user has already copied to the cost sheet, so they know where to resume next time.
 - Avoids paid subscriptions for historical data while still working across multiple machines.

 ## Solution

 Build a VS Code extension named **CodePulse** that:

 1. Depends on the existing WakaTime VS Code extension for heartbeat collection and project detection.
 2. Reuses the WakaTime API key stored in `~/.wakatime.cfg` so the user does not need to configure another key.
 3. Calls the WakaTime `/api/v1/users/current/summaries` endpoint to fetch 7/30/90 days of summaries.
 4. Renders a single lightweight dashboard inside a VS Code Webview using plain HTML/CSS/TypeScript and the uPlot charting library.
 5. Adds a status bar item that shows today's coding time and opens the dashboard when clicked.
 6. Persists the "last recorded date" in `ExtensionContext.globalState` and explicitly registers it for sync with `setKeysForSync`, so the bookkeeping marker follows the user across machines via VS Code Settings Sync.
 7. Leaves the door open for a future local collector by defining an abstract `collector` interface; the first implementation is a WakaTime API adapter.

 ## User Stories

 1. As a developer, I want to see my total coding time for the last 7, 30, or 90 days inside VS Code, so that I can estimate project effort without leaving the editor.
 2. As a developer, I want to see my average coding time per day for the selected window, so that I can understand my daily cadence.
 3. As a developer, I want a bar chart showing daily coding time for the selected window, so that I can spot spikes and dips at a glance.
 4. As a developer, I want a project list with total hours and a percentage/progress bar for the selected window, so that I can copy each project's total into the cost sheet.
 5. As a developer, I want to click a "Mark today as recorded" button in the dashboard, so that I remember I have already copied today's data to the cost sheet.
 6. As a developer, I want the dashboard to display the last recorded date, so that I know where to resume manual bookkeeping next time.
 7. As a developer, I want the last recorded date to sync across my machines via VS Code Settings Sync, so that I do not re-record the same day on a different laptop.
 8. As a developer, I want a status bar item showing today's coding time, so that I have a quick at-a-glance view and can hide the WakaTime status bar item.
 9. As a developer, I want the dashboard to refresh automatically when opened, so that I see the latest data without extra clicks.
 10. As a developer, I want a manual refresh button in the dashboard, so that I can update the view after a coding session.
 11. As a developer, I want to see a clear text message when the WakaTime plugin is missing or unconfigured, so that I know how to fix the dependency.
 12. As a developer, I want to see a clear text message when the WakaTime API request fails, so that I can check my network or proxy.
 13. As a developer, I want a link to the WakaTime website from the dashboard, so that I can quickly open my WakaTime dashboard if needed.
 14. As a developer, I want the extension to use the same project names as WakaTime (Git repository names), so that I do not need to maintain a project mapping.
 15. As a developer, I want the extension to work without sending my code stats to any new server, so that I can keep relying on WakaTime for collection while only adding a local presentation layer.
 16. As a developer, I want the data collection abstraction to be replaceable, so that I can switch to a local collector if WakaTime restrictions or pricing change in the future.
 17. As a developer, I want the dashboard to be a single page without a complex build pipeline, so that the extension is easy to maintain and debug.
 18. As a developer, I want the charting library to be small and fast, so that the dashboard loads quickly inside a Webview.
 19. As a developer, I want the 7/30/90-day selector to be a global tab bar at the top of the dashboard, so that all modules switch ranges together.
 20. As a developer, I want an empty state when no coding time exists for the selected range, so that I understand the difference between "no data" and "loading failed".

 ## Implementation Decisions

 - **VS Code Extension Host**: The extension runs in the VS Code extension host. It reads `~/.wakatime.cfg`, fetches WakaTime summaries, and exposes a dashboard command.
 - **Collector Abstraction**: Define a `TimeCollector` interface with methods like `getSummaries(start: Date, end: Date)` returning a normalized summary shape. The first implementation is `WakaTimeCollector`.
 - **WakaTime Collector**: Reads the `api_key` from the `[settings]` section of `~/.wakatime.cfg` using HTTP Basic Auth against `https://wakatime.com/api/v1/users/current/summaries`.
 - **Dashboard Webview**: A single Webview panel with a global 7/30/90 tab selector. It uses plain HTML/CSS/TypeScript and uPlot for the bar chart. Data is passed via `postMessage`.
 - **Aggregation**: The extension host aggregates daily totals and project totals from the WakaTime summaries response before sending them to the Webview.
 - **Status Bar**: A status bar item shows today's coding time in `Xh Ym` format. Clicking it opens the dashboard.
 - **Bookkeeping Marker**: `lastRecordedDate` is stored as an ISO date string in `ExtensionContext.globalState`. The activation code calls `globalState.setKeysForSync(['lastRecordedDate'])` so VS Code Settings Sync propagates it.
 - **No Local Cache**: The dashboard fetches data every time it is opened or refreshed. No persistent local cache is implemented for this MVP.
 - **No Tencent Docs Integration**: Pushing data to Tencent Docs is explicitly out of scope for this MVP. The user will continue to manually copy values from the project list.
 - **No Custom Project Mapping**: WakaTime project names are used directly because the user's cost sheet is one-repository-one-project.
 - **Error Handling**: Missing config or API failures are surfaced as plain text messages inside the dashboard with a retry button.

 ## Testing Decisions

 - **Unit Tests for Aggregation**: The module that transforms raw WakaTime summaries into daily totals and project totals should be unit tested with mocked WakaTime responses.
 - **Manual Webview Tests**: The Webview rendering and uPlot chart will be validated manually by opening the dashboard in VS Code and switching the 7/30/90 tabs.
 - **Manual Integration Tests**: Fetching real WakaTime data will be verified manually with the user's API key across the supported ranges.
 - **Settings Sync Test**: Verify that `lastRecordedDate` set on one machine appears after VS Code Settings Sync on another machine.
 - **No Tests for VS Code Extension API Glue**: The extension host command registration, Webview creation, and `postMessage` wiring are considered thin glue and will be covered by manual end-to-end tests rather than unit tests.
 - **No Tests for WakaTime API Client**: The actual HTTP client to WakaTime is treated as a simple adapter; failures are handled by the error path and verified manually.

 ## Out of Scope

 - Automatic synchronization with Tencent Docs or any other spreadsheet.
 - Local heartbeat collection (the current MVP relies on WakaTime).
 - Editing or manually adding time entries.
 - Per-file or per-language breakdown.
 - Custom project name mapping or renaming.
 - Caching of WakaTime responses to reduce API calls.
 - OAuth-based authentication to WakaTime (uses the existing API key in `~/.wakatime.cfg`).
 - Leaderboards, public profiles, or team features.
 - Mobile or browser support.

 ## Further Notes

 - The WakaTime Free plan dashboard is limited to one week of history, but the API was verified to return at least 90 days of summary data for the user's free account. The implementation relies on this API behavior.
 - The user confirmed that the project names WakaTime derives from Git repository names map directly to the projects in the cost sheet.
 - The user already has a proxy and can reach `wakatime.com` from their machine; the extension will not bundle a proxy.
 - The user wants to hide the WakaTime status bar item after CodePulse provides its own status bar item. The extension will not modify WakaTime settings; hiding WakaTime's status bar is left to the user via WakaTime's own preferences.
