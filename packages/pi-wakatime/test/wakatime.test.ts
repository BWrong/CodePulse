import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ChildProcess } from "node:child_process";
import wakatimeExtension, {
  buildSyncArgs,
  findWakatimeCli,
  syncWakatime,
} from "../extensions/wakatime.ts";

test("buildSyncArgs uses WakaTime AI activity sync", () => {
  assert.deepEqual(buildSyncArgs("/tmp/project"), [
    "--sync-ai-activity",
    "--plugin",
    "pi-wakatime/0.1.0",
    "--project-folder",
    "/tmp/project",
  ]);
});

test("findWakatimeCli prefers WAKATIME_CLI", () => {
  assert.equal(
    findWakatimeCli({ WAKATIME_CLI: "/custom/wakatime-cli" }, "/home/test", "linux"),
    "/custom/wakatime-cli",
  );
});

test("findWakatimeCli finds the local WakaTime installation", () => {
  const home = mkdtempSync(join(tmpdir(), "pi-wakatime-"));
  const localCli = join(home, ".wakatime", "wakatime-cli");

  mkdirSync(join(home, ".wakatime"));
  writeFileSync(localCli, "");

  assert.equal(findWakatimeCli({}, home, "darwin"), localCli);
});

test("findWakatimeCli falls back to PATH", () => {
  assert.equal(findWakatimeCli({}, "/missing-home", "linux"), "wakatime-cli");
});

test("syncWakatime launches WakaTime without blocking Pi", () => {
  let command = "";
  let args: string[] = [];
  let options: Record<string, unknown> = {};
  let unrefCalled = false;

  const fakeChild = {
    on() {
      return this;
    },
    unref() {
      unrefCalled = true;
    },
  } as unknown as ChildProcess;

  syncWakatime("/tmp/project", {
    env: { WAKATIME_CLI: "/custom/wakatime-cli" },
    spawn: (nextCommand, nextArgs, nextOptions) => {
      command = nextCommand;
      args = nextArgs;
      options = nextOptions as Record<string, unknown>;
      return fakeChild;
    },
  });

  assert.equal(command, "/custom/wakatime-cli");
  assert.deepEqual(args, buildSyncArgs("/tmp/project"));
  assert.equal(options.detached, true);
  assert.equal(options.stdio, "ignore");
  assert.equal(unrefCalled, true);
});

test("extension subscribes to settled agents and session shutdown", () => {
  const events: string[] = [];
  const pi = {
    on(event: string) {
      events.push(event);
    },
  };

  wakatimeExtension(pi as never);

  assert.deepEqual(events, ["agent_settled", "session_shutdown"]);
});
