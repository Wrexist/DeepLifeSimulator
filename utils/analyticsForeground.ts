// Synchronous dispatch boundary while a native lifecycle permission read is pending.
let foreground = true;
let revision = 0;
export const isAnalyticsForeground = (): boolean => foreground;
export const analyticsForegroundRevision = (): number => revision;
export function setAnalyticsForeground(value: boolean): void {
  if (value !== foreground) revision++;
  foreground = value;
}
