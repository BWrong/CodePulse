import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PLUGIN_NAME = "pi-wakatime";
const PLUGIN_VERSION = "0.1.0";

type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

interface SyncOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  platform?: NodeJS.Platform;
  spawn?: SpawnFn;
}

export function buildSyncArgs(projectFolder: string): string[] {
  return [
    "--sync-ai-activity",
    "--plugin",
    `${PLUGIN_NAME}/${PLUGIN_VERSION}`,
    "--project-folder",
    projectFolder,
  ];
}

export function findWakatimeCli(
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
  platform: NodeJS.Platform = process.platform,
): string {
  const configured = env.WAKATIME_CLI?.trim();
  if (configured) return configured;

  const binary = platform === "win32" ? "wakatime-cli.exe" : "wakatime-cli";
  const localCli = join(home, ".wakatime", binary);

  return existsSync(localCli) ? localCli : binary;
}

export function syncWakatime(projectFolder: string, options: SyncOptions = {}): void {
  const env = options.env ?? process.env;
  const spawnImpl = options.spawn ?? spawn;
  const home = options.home ?? env.WAKATIME_HOME ?? homedir();
  const command = findWakatimeCli(env, home, options.platform);

  try {
    const child = spawnImpl(command, buildSyncArgs(projectFolder), {
      detached: true,
      env,
      stdio: "ignore",
      windowsHide: true,
    });

    child.on("error", () => {});
    child.unref();
  } catch {
    // WakaTime must never interrupt Pi shutdown or agent completion.
  }
}

function syncFromContext(_event: unknown, ctx: ExtensionContext): void {
  syncWakatime(ctx.cwd);
}

export default function wakatimeExtension(pi: ExtensionAPI): void {
  pi.on("agent_settled", syncFromContext);
  pi.on("session_shutdown", syncFromContext);
}
