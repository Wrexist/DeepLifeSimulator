/**
 * App notification badges — turns the phone/computer launcher into a dashboard.
 *
 * Each app already computes its own "needs attention" signal in state; this
 * surfaces them as a per-app-id count so the grid tiles can show a red badge.
 * Everything is defensively optional-chained: a missing/partial field yields 0,
 * never a crash, so it is safe on legacy/degraded saves.
 *
 * Keys are the app ids used by both grids (mobile.tsx + computer.tsx). Pets use
 * 'pet' on mobile and 'paw' on computer, so both are set.
 */
import type { GameState } from '@/contexts/game/types';

export function getAppBadgeCounts(gameState: GameState | undefined | null): Record<string, number> {
  const g = gameState as any;
  const counts: Record<string, number> = {};
  if (!g) return counts;

  try {
    // Spark — matches with unread messages from the NPC.
    const matches: any[] = g.sparkApp?.matches ?? [];
    const sparkUnread = matches.reduce(
      (n, m) => n + ((m?.unreadByPlayer ?? 0) > 0 ? 1 : 0),
      0,
    );
    if (sparkUnread > 0) counts.tinder = sparkUnread;

    // Pulse — an active scandal is the loudest "handle this now" signal.
    if (g.socialMedia?.activeScandal) counts.social = 1;

    // Pets — any pet in critical condition (low health or starving) needs care.
    const pets: any[] = g.pets ?? [];
    const critical = pets.reduce(
      (n, p) => n + (!p?.isDead && ((p?.health ?? 100) <= 20 || (p?.hunger ?? 100) <= 10) ? 1 : 0),
      0,
    );
    if (critical > 0) { counts.pet = critical; counts.paw = critical; }

    // DeepMail — unread inbox. This is the badge that makes mail a CHANNEL
    // rather than a screen: a payslip the player never opens is not a feature.
    const messages: any[] = g.mail?.messages ?? [];
    const mailUnread = messages.reduce(
      (n, m) => n + (m && (m.folder ?? 'inbox') === 'inbox' && !m.read ? 1 : 0),
      0,
    );
    if (mailUnread > 0) counts.mail = mailUnread;

    // Hustle / companies — unread company notifications (scandals, offers).
    const companies: any[] = g.companies ?? [];
    const companyUnread = companies.reduce((n, c) => {
      const notes: any[] = c?.overlay?.notifications ?? [];
      return n + notes.filter((x) => x && x.read === false).length;
    }, 0);
    if (companyUnread > 0) counts.company = companyUnread;
  } catch {
    // Never let a badge computation break the launcher.
  }

  return counts;
}
