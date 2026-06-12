/**
 * Diagnostic report builder — turns a live game state (and optional error) into
 * a rich, copy-paste-able support report. The whole point is that when a player
 * taps "Report", the message that reaches us already contains everything we need
 * to debug: build marker, platform, game position, state validation, and the
 * most recent error/warning logs — no back-and-forth required.
 *
 * Everything here is defensive: a report must never throw (it's used on the
 * crash/error path), so each section is wrapped and degrades to a placeholder.
 */

import { Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import { BUILD_TAG } from '@/lib/config/buildTag';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { SUPPORT_EMAIL, DISCORD_URL } from '@/lib/config/appConfig';
import { aiDebugContext } from '@/src/debug/aiDebugConfig';
import { logger } from '@/utils/logger';

interface BuildReportOptions {
  /** Live game state, if available (preferred — gives the richest report). */
  gameState?: any;
  /** An Error the report is about (crash/error path). */
  error?: unknown;
  /** Free-text the player typed describing what happened. */
  userNote?: string;
  /** Short label for where the report was triggered (e.g. "Work screen"). */
  source?: string;
}

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/**
 * Resolve the game state to report on: the explicitly-passed state wins, but if
 * a caller has none (e.g. a global toast handler), fall back to the live state
 * getter registered with the AI debug context. This is what lets a one-tap
 * "Report" from anywhere still produce a rich, debuggable report.
 */
function resolveGameState(passed?: any): any {
  if (passed) return passed;
  return safe(() => aiDebugContext.getStoreState?.() ?? undefined, undefined);
}

function currentScreen(): string {
  return safe(() => aiDebugContext.getCurrentScreen?.() || 'unknown', 'unknown');
}

function appVersion(): string {
  return safe(() => Constants.expoConfig?.version || 'unknown', 'unknown');
}

function buildNumber(): string {
  return safe(() => {
    // iOS exposes buildNumber; Android exposes versionCode. Report whichever
    // applies so Android crash triage isn't stuck on "dev".
    if (Platform.OS === 'android') {
      return String(Constants.expoConfig?.android?.versionCode ?? 'dev');
    }
    return String(Constants.expoConfig?.ios?.buildNumber ?? 'dev');
  }, 'dev');
}

/** Pull the last few error/warning log lines (no full state dumps). */
function recentErrorLogs(): string {
  return safe(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { remoteLogger } = require('@/services/RemoteLoggingService');
    const all = remoteLogger?.getLogs?.() || [];
    const lines = all
      .filter((l: any) => l.level === 'error' || l.level === 'warn')
      .slice(-12)
      .map((l: any) => `[${l.timestamp}] [${String(l.level).toUpperCase()}] ${l.message}`);
    return lines.length > 0 ? lines.join('\n') : 'No recent error/warning logs.';
  }, 'Logs unavailable.');
}

function stateValidationSummary(gameState: any): string {
  if (!gameState) return 'No live game state (player may be in a menu).';
  return safe(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validateGameState } = require('@/utils/saveValidation');
    const v = validateGameState(gameState, false);
    const errs = Array.isArray(v?.errors) ? v.errors.slice(0, 4) : [];
    return [
      `Valid: ${v?.valid ? 'yes' : 'NO'}`,
      `Errors: ${v?.errors?.length ?? 0}  Warnings: ${v?.warnings?.length ?? 0}`,
      errs.length > 0 ? `Key errors: ${errs.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, 'State validation unavailable.');
}

function gamePosition(gameState: any): string {
  if (!gameState) return 'No active game session.';
  return safe(() => {
    const s = gameState.stats || {};
    const d = gameState.date || {};
    const counts = {
      careers: gameState.careers?.length ?? 0,
      items: gameState.items?.length ?? 0,
      relationships: gameState.relationships?.length ?? 0,
      educations: gameState.educations?.length ?? 0,
      pendingEvents: gameState.pendingEvents?.length ?? 0,
    };
    return [
      `Scenario: ${gameState.scenarioId || gameState.challengeScenarioId || 'n/a'}`,
      `Week: ${gameState.week ?? 'n/a'}  WeeksLived: ${gameState.weeksLived ?? 'n/a'}`,
      `Year/Month: ${Math.floor(d.year ?? 0)}/${d.month ?? '?'}  Age: ${Math.floor(d.age ?? 0)}`,
      `Generation: ${gameState.generationNumber ?? 1}  Prestige: ${gameState.prestige?.prestigeLevel ?? 0}`,
      `Job: ${gameState.currentJob || 'none'}`,
      `Money: ${Math.floor(s.money ?? 0)}  Bank: ${Math.floor(gameState.bankSavings ?? 0)}  Gems: ${Math.floor(s.gems ?? 0)}`,
      `Stats: H${Math.round(s.health ?? 0)} / Hap${Math.round(s.happiness ?? 0)} / E${Math.round(s.energy ?? 0)}`,
      `Arrays: careers(${counts.careers}) items(${counts.items}) rel(${counts.relationships}) edu(${counts.educations}) events(${counts.pendingEvents})`,
    ].join('\n');
  }, 'Could not read game position.');
}

function errorSection(error: unknown): string {
  if (!error) return '';
  return safe(() => {
    const err = error instanceof Error ? error : new Error(String(error));
    const stack = err.stack ? err.stack.split('\n').slice(0, 12).join('\n') : 'No stack trace.';
    return `\n--- ERROR ---\nMessage: ${err.message}\n${stack}\n`;
  }, '\n--- ERROR ---\n(could not read error)\n');
}

/**
 * Build the full diagnostic report text. Never throws.
 */
export function buildDiagnosticReport(options: BuildReportOptions = {}): string {
  const { error, userNote, source } = options;
  const gameState = resolveGameState(options.gameState);
  const note = userNote && userNote.trim().length > 0 ? userNote.trim() : '(none provided)';

  return [
    '=== DEEPLIFE SIMULATOR — PLAYER REPORT ===',
    `Generated: ${new Date().toISOString()}`,
    source ? `Triggered from: ${source}` : '',
    `Screen: ${currentScreen()}`,
    '',
    '--- WHAT HAPPENED (from player) ---',
    note,
    '',
    '--- BUILD / DEVICE ---',
    `Build marker: ${BUILD_TAG}`,
    `App version: ${appVersion()} (build ${buildNumber()})`,
    `Device: ${safe(() => Constants.deviceName || 'unknown', 'unknown')}`,
    `State version: ${STATE_VERSION}`,
    `Platform: ${Platform.OS} ${String(Platform.Version)}`,
    `Environment: ${__DEV__ ? 'dev' : 'prod'}`,
    errorSection(error),
    '--- GAME POSITION ---',
    gamePosition(gameState),
    '',
    '--- STATE VALIDATION ---',
    stateValidationSummary(gameState),
    '',
    '--- RECENT LOGS (errors/warnings) ---',
    recentErrorLogs(),
    '',
    `Need help fast? Join our Discord: ${DISCORD_URL}`,
    '=== END OF REPORT ===',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** A short subject line derived from the error/source. */
function reportSubject(options: BuildReportOptions): string {
  const err = options.error instanceof Error ? options.error.message : undefined;
  const base = err || options.source || 'Player report';
  return `DeepLife report: ${String(base).slice(0, 70)}`;
}

/**
 * Open the player's mail client pre-filled with the full diagnostic report.
 * Returns false if no mail client could be opened (caller can fall back).
 */
export async function emailDiagnosticReport(options: BuildReportOptions = {}): Promise<boolean> {
  const report = buildDiagnosticReport(options);
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(reportSubject(options))}&body=${encodeURIComponent(report)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch (e) {
    logger.warn('emailDiagnosticReport: could not open mail client', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/** Open the native Share sheet with the full diagnostic report. */
export async function shareDiagnosticReport(options: BuildReportOptions = {}): Promise<boolean> {
  const report = buildDiagnosticReport(options);
  try {
    const result = await Share.share({ message: report, title: 'DeepLife Simulator Report' });
    return result.action === Share.sharedAction;
  } catch (e) {
    logger.warn('shareDiagnosticReport: share failed', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/** Open the Discord invite. */
export async function openSupportDiscord(): Promise<void> {
  try {
    await Linking.openURL(DISCORD_URL);
  } catch (e) {
    logger.warn('openSupportDiscord: could not open Discord', { error: e instanceof Error ? e.message : String(e) });
  }
}

export const SUPPORT_EMAIL_ADDRESS = SUPPORT_EMAIL;
export const SUPPORT_DISCORD_URL = DISCORD_URL;
