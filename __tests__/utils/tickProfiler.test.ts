import { tickProfiler } from '@/utils/tickProfiler';

/**
 * H3 — the per-phase tick profiler. We drive `performance.now()` with a fake clock so the
 * timing math is deterministic, and keep the profiler quiet via a no-op summary sink.
 */
describe('tickProfiler', () => {
  let clock = 0;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    clock = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => clock);
    tickProfiler.reset();
    tickProfiler.setSummarySink(() => {}); // silence periodic logs
    tickProfiler.setEnabled(true);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    tickProfiler.setEnabled(false);
    tickProfiler.setSummarySink(null);
    tickProfiler.reset();
  });

  it('records per-phase durations from marks', () => {
    tickProfiler.beginTick(); // clock = 0
    clock = 10;
    tickProfiler.mark('a'); // a = 10 - 0
    clock = 25;
    tickProfiler.mark('b'); // b = 25 - 10
    tickProfiler.endTick();

    const s = tickProfiler.getSummary();
    expect(s.ticks).toBe(1);
    expect(s.phases.find((p) => p.phase === 'a')?.meanMs).toBe(10);
    expect(s.phases.find((p) => p.phase === 'b')?.meanMs).toBe(15);
    expect(s.totalMeanMs).toBe(25);
  });

  it('is a complete no-op when disabled (zero behaviour/cost)', () => {
    tickProfiler.setEnabled(false);
    tickProfiler.beginTick();
    clock = 999;
    tickProfiler.mark('a');
    tickProfiler.endTick();

    const s = tickProfiler.getSummary();
    expect(s.phases).toHaveLength(0);
    expect(s.ticks).toBe(0);
  });

  it('ignores marks outside a begin/end tick window', () => {
    // No beginTick() → started=false → marks are dropped.
    clock = 50;
    tickProfiler.mark('orphan');
    expect(tickProfiler.getSummary().phases).toHaveLength(0);
  });

  it('computes mean / p95 / max over the rolling sample window', () => {
    for (let d = 1; d <= 20; d++) {
      clock = 0;
      tickProfiler.beginTick();
      clock = d;
      tickProfiler.mark('x'); // duration = d ms
      tickProfiler.endTick();
    }
    const x = tickProfiler.getSummary().phases.find((p) => p.phase === 'x')!;
    expect(x.count).toBe(20);
    expect(x.maxMs).toBe(20);
    expect(x.meanMs).toBe(10.5); // mean of 1..20
    expect(x.p95Ms).toBe(19); // ceil(0.95*20)-1 = index 18 → 19
  });

  it('sorts phases hottest-first by p95 and routes the periodic summary to the sink', () => {
    const summaries: number[] = [];
    tickProfiler.setSummarySink((s) => summaries.push(s.ticks));
    // 25 ticks triggers exactly one periodic emit (logEvery = 25). 'slow' >> 'fast'.
    for (let i = 0; i < 25; i++) {
      clock = 0;
      tickProfiler.beginTick();
      clock = 2;
      tickProfiler.mark('fast');
      clock = 12;
      tickProfiler.mark('slow');
      tickProfiler.endTick();
    }
    expect(summaries).toEqual([25]); // emitted once, at tick 25
    const phases = tickProfiler.getSummary().phases;
    expect(phases[0].phase).toBe('slow'); // hottest first
    expect(phases[1].phase).toBe('fast');
  });
});
