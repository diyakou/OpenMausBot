import { appendFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const RETENTION_MS = 10 * 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;

export function createDesktopLaunchLog(directory, onError) {
  const file = join(directory, "desktop-launches.log");
  let cleanup;

  function removeExpired() {
    const stat = statSync(file, { throwIfNoEntry: false });
    if (!stat) return null;
    const expiresAt = (stat.birthtimeMs || stat.mtimeMs) + RETENTION_MS;
    if (expiresAt > Date.now()) return expiresAt;
    rmSync(file, { force: true });
    return null;
  }

  function schedule(at) {
    clearTimeout(cleanup);
    if (at === null) return;
    cleanup = setTimeout(() => {
      try {
        schedule(removeExpired());
      } catch (error) {
        onError(error);
        schedule(Date.now() + RETRY_MS);
      }
    }, Math.max(1, Math.ceil(at - Date.now())));
    cleanup.unref();
  }

  return function recordLaunch() {
    try {
      const expiresAt = removeExpired();
      const now = Date.now();
      mkdirSync(directory, { recursive: true });
      appendFileSync(file, `[${new Date(now).toISOString()}] Application opened\n`, { mode: 0o600 });
      schedule(expiresAt ?? now + RETENTION_MS);
    } catch (error) {
      onError(error);
      schedule(Date.now() + RETRY_MS);
    }
  };
}
