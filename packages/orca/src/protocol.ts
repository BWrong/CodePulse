// 面板与 worker 的协议：面板发命令，worker 回一串消息（顺序即渲染顺序）。
export {}

/** 面板里那条 window 'message' 事件的数据（原 VS Code 扩展的 postMessage 负载）。 */
export type PanelMessage = { command: string } & Record<string, any>

export type RequestResult = { messages: PanelMessage[] }

declare module 'orca' {
  interface PluginRequests {
    /** 面板打开：首屏汇总 + 当日项目分布。 */
    ready: { output: RequestResult }
    /** 强制重拉汇总。 */
    refresh: { output: RequestResult }
    changeRange: { input: { days: number }; output: RequestResult }
    changeProjectDay: { input: { projectDay: string }; output: RequestResult }
    clickProject: { input: { projectName: string }; output: RequestResult }
    markRecorded: { output: RequestResult }
    setToken: { input: { token: string }; output: RequestResult }
  }
}
