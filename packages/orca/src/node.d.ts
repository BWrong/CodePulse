// Orca 的插件 tsconfig 只认 .orca/types 下的类型（typeRoots 被限制在那个目录），
// 没有随附 Node 类型；这里只声明裸读 ~/.wakatime.cfg 用到的那几个函数。
declare module 'fs' {
  export function existsSync(path: string): boolean
  export function readFileSync(path: string, encoding: 'utf-8'): string
}

declare module 'os' {
  export function homedir(): string
}

declare var process: {
  env: Record<string, string | undefined>
}
