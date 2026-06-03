import {
  attemptStage,
  awardSkillXp,
  initialSkill,
  JOB_TEMPLATES,
  startJob,
  stageSuccessProbability,
  xpForLevel,
} from '../jobs';

describe('xpForLevel', () => {
  it('grows geometrically', () => {
    const l1 = xpForLevel(1);
    const l5 = xpForLevel(5);
    expect(l5).toBeGreaterThan(l1 * 5);
  });
});

describe('initialSkill', () => {
  it('starts at level 1 with 0 XP', () => {
    const s = initialSkill();
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    expect(s.nextLevelXp).toBeGreaterThan(0);
  });
});

describe('awardSkillXp', () => {
  it('does not level up below threshold', () => {
    const s = initialSkill();
    const r = awardSkillXp(s, 50);
    expect(r.level).toBe(1);
    expect(r.xp).toBe(50);
  });

  it('levels up when threshold is crossed', () => {
    const s = initialSkill();
    const r = awardSkillXp(s, 200);
    expect(r.level).toBeGreaterThan(1);
  });

  it('caps at level 20', () => {
    const s = initialSkill();
    const r = awardSkillXp(s, 10_000_000);
    expect(r.level).toBeLessThanOrEqual(20);
  });
});

describe('stageSuccessProbability', () => {
  it('returns ~50% when effective skill matches difficulty', () => {
    // level 5 → eff 55; difficulty 55 → near 50/50
    expect(stageSuccessProbability(5, 55)).toBeCloseTo(0.5, 1);
  });

  it('above 80% when skill >> difficulty', () => {
    expect(stageSuccessProbability(10, 30)).toBeGreaterThan(0.9);
  });

  it('below 20% when difficulty >> skill', () => {
    expect(stageSuccessProbability(1, 90)).toBeLessThan(0.05);
  });
});

describe('attemptStage', () => {
  const easyStage = {
    kind: 'recon' as const,
    skill: 'opsec' as const,
    difficulty: 10,
    heatOnFail: 5,
    heatOnSuccess: 1,
    energyCost: 8,
  };

  it('succeeds on a roll below P(success)', () => {
    const r = attemptStage(easyStage, 10, 0.01);
    expect(r.success).toBe(true);
    expect(r.heatAdded).toBe(easyStage.heatOnSuccess);
  });

  it('fails on a roll above P(success)', () => {
    const hardStage = { ...easyStage, difficulty: 99 };
    const r = attemptStage(hardStage, 1, 0.99);
    expect(r.success).toBe(false);
    expect(r.heatAdded).toBe(hardStage.heatOnFail);
  });

  it('awards more XP on success', () => {
    const success = attemptStage(easyStage, 10, 0.01);
    const fail = attemptStage(easyStage, 1, 0.99);
    expect(success.xpAwarded).toBeGreaterThan(fail.xpAwarded);
  });
});

describe('startJob', () => {
  const skills = {
    hacking:    initialSkill(),
    social:     initialSkill(),
    opsec:      initialSkill(),
    laundering: initialSkill(),
  };

  it('starts a job that has no prereqs', () => {
    const phishing = JOB_TEMPLATES[0];
    const r = startJob(phishing, skills, 1);
    expect(r.ok).toBe(true);
  });

  it('rejects a job whose required skill is too low', () => {
    const corp = JOB_TEMPLATES.find((t) => t.id === 'corp-breach')!;
    const r = startJob(corp, skills, 1);
    expect(r.ok).toBe(false);
  });

  it('allows the same job once skill prereqs are met', () => {
    const corp = JOB_TEMPLATES.find((t) => t.id === 'corp-breach')!;
    const beefedSkills = {
      ...skills,
      hacking: { ...skills.hacking, level: 5 },
      social: { ...skills.social, level: 4 },
    };
    const r = startJob(corp, beefedSkills, 1);
    expect(r.ok).toBe(true);
  });
});

describe('JOB_TEMPLATES sanity', () => {
  it('every template has at least 3 stages and a positive payout', () => {
    for (const t of JOB_TEMPLATES) {
      expect(t.stages.length).toBeGreaterThanOrEqual(3);
      expect(t.payoutBtc).toBeGreaterThan(0);
    }
  });

  it('templates are sorted by payout ascending', () => {
    for (let i = 1; i < JOB_TEMPLATES.length; i++) {
      expect(JOB_TEMPLATES[i].payoutBtc).toBeGreaterThanOrEqual(JOB_TEMPLATES[i - 1].payoutBtc);
    }
  });
});
