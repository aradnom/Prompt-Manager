import type { WatchdogService } from "@server/services/watchdog-service";

let _watchdog: WatchdogService | null = null;

export function setWatchdog(w: WatchdogService): void {
  _watchdog = w;
}

export function getWatchdog(): WatchdogService | null {
  return _watchdog;
}
