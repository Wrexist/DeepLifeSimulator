import { JOB_TEMPLATES, DarkWebJobTemplate, DarkWebSkillId } from '../jobs';

const SKILLS: DarkWebSkillId[] = ['hacking', 'social', 'opsec', 'laundering'];
const STAGE_KINDS = ['recon', 'social', 'exploit', 'exfiltrate', 'fence'];
const CATEGORIES = ['data-theft', 'fraud', 'corporate', 'crypto'];

/** Jobs added in the v23 pack. */
const NEW_IDS = [
  'data-entry-gig',
  'survey-fraud',
  'account-takeover',
  'sim-swap',
  'ransomware-smb',
  'medical-records',
  'wire-fraud-bec',
  'defi-flashloan',
  'supply-chain',
  'apt-nation-state',
];

const gateSum = (t: DarkWebJobTemplate): number =>
  Object.values(t.requiresSkills ?? {}).reduce((s, v) => s + (v ?? 0), 0);

const maxDifficulty = (t: DarkWebJobTemplate): number =>
  Math.max(...t.stages.map((s) => s.difficulty));

describe('dark-web job roster', () => {
  it('includes every new job and the four originals, with unique ids', () => {
    const ids = JOB_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of NEW_IDS) expect(ids).toContain(id);
    for (const id of ['phish-pack', 'card-dump', 'corp-breach', 'crypto-exchange-pivot']) {
      expect(ids).toContain(id);
    }
    // 4 originals + 10 new.
    expect(JOB_TEMPLATES.length).toBe(14);
  });

  it('every template is structurally valid', () => {
    for (const t of JOB_TEMPLATES) {
      expect(t.stages.length).toBeGreaterThanOrEqual(3);
      expect(t.payoutBtc).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(t.category);
      for (const s of t.stages) {
        expect(STAGE_KINDS).toContain(s.kind);
        expect(SKILLS).toContain(s.skill);
        expect(s.difficulty).toBeGreaterThanOrEqual(1);
        expect(s.difficulty).toBeLessThanOrEqual(100);
        expect(s.heatOnFail).toBeGreaterThanOrEqual(0);
        expect(s.heatOnSuccess).toBeGreaterThanOrEqual(0);
        // A failed stage must sting at least as much as a clean one.
        expect(s.heatOnFail).toBeGreaterThanOrEqual(s.heatOnSuccess);
        expect(s.energyCost).toBeGreaterThan(0);
      }
    }
  });

  it('skill gates reference real skills with sane minimum levels', () => {
    for (const t of JOB_TEMPLATES) {
      if (!t.requiresSkills) continue;
      for (const [skill, min] of Object.entries(t.requiresSkills)) {
        expect(SKILLS).toContain(skill as DarkWebSkillId);
        expect(min).toBeGreaterThanOrEqual(1);
        expect(min).toBeLessThanOrEqual(10);
      }
    }
  });

  it('payouts are strictly ascending (the roster is a curve)', () => {
    for (let i = 1; i < JOB_TEMPLATES.length; i++) {
      expect(JOB_TEMPLATES[i].payoutBtc).toBeGreaterThan(JOB_TEMPLATES[i - 1].payoutBtc);
    }
  });

  it('risk scales monotonically with reward (gate + difficulty never regress up the ladder)', () => {
    const byPayout = [...JOB_TEMPLATES].sort((a, b) => a.payoutBtc - b.payoutBtc);
    for (let i = 1; i < byPayout.length; i++) {
      // Higher payout ⇒ at-least-as-steep a skill gate…
      expect(gateSum(byPayout[i])).toBeGreaterThanOrEqual(gateSum(byPayout[i - 1]));
      // …and at-least-as-hard a hardest stage.
      expect(maxDifficulty(byPayout[i])).toBeGreaterThanOrEqual(maxDifficulty(byPayout[i - 1]));
    }
  });

  it('the elite tier out-gates and out-pays the rest', () => {
    const apt = JOB_TEMPLATES.find((t) => t.id === 'apt-nation-state')!;
    const others = JOB_TEMPLATES.filter((t) => t.id !== 'apt-nation-state');
    for (const t of others) {
      expect(apt.payoutBtc).toBeGreaterThan(t.payoutBtc);
      expect(gateSum(apt)).toBeGreaterThanOrEqual(gateSum(t));
    }
  });
});
