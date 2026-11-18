import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createDesktopLaunchLog } from "./desktop-launch-log.mjs";

const TEN_HOURS = 10 * 60 * 60 * 1000;

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "omb-desktop-launch-log-"));
  const file = join(directory, "desktop-launches.log");
  t.after(() => {
    rmSync(file, { force: true });
    rmdirSync(directory);
  });
  return {
    file,
    record: createDesktopLaunchLog(directory, (error) => assert.fail(error)),
  };
}

test("records each launch and deletes the file after ten hours while open", (t) => {
  const { file, record } = fixture(t);
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.now() });
  record();
  record();
  assert.equal(readFileSync(file, "utf8").match(/Application opened/g)?.length, 2);
  t.mock.timers.tick(TEN_HOURS - 1_000);
  assert.equal(existsSync(file), true);
  t.mock.timers.tick(2_000);
  assert.equal(existsSync(file), false);
  record();
  assert.equal(readFileSync(file, "utf8").match(/Application opened/g)?.length, 1);
});

test("replaces a launch log that expired while the app was closed", (t) => {
  const { file, record } = fixture(t);
  writeFileSync(file, "old launch\n");
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: Math.ceil(statSync(file).birthtimeMs) + TEN_HOURS + 1 });
  record();
  assert.match(readFileSync(file, "utf8"), /^\[.*\] Application opened\n$/);
});
