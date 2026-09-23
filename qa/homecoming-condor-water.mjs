// Controlled Rio water entry after a real condor mount and release.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const harness = await openHarness({ pinRung: false });
try {
  await harness.start();
  await harness.arrive('rio');
  await harness.page.keyboard.press('q');
  await harness.page.waitForFunction(() => window.__capy.condor.state === 'circling', null, { timeout: 60000 });
  await harness.page.keyboard.press('q');
  await harness.page.keyboard.down('e');
  try {
    await harness.page.waitForFunction(() => window.__capy.condor.mounted, null, { timeout: 60000 });
  } finally { await harness.page.keyboard.up('e'); }

  const report = await harness.page.evaluate(() => {
    const g = window.__capy, b = g.capy.body;
    if (!g.condor.release()) throw Error('mounted release failed');
    if (!g.rio.isOverWater(0, -50) || g.rio.terrainHeight(0, -50) >= -2)
      throw Error('fixture is not deep open water');
    // This is a controlled landing, not a claim about the natural flight route.
    b.position.set(0, 2, -50);
    b.velocity.set(0, -10, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    const rows = [], raw = g.condor.update;
    g.condor.update = function (dt) {
      const before = b.velocity.toArray();
      const result = raw.call(this, dt);
      if (g.capy.swimming && rows.length < 12) rows.push({
        t: g.state.time, y: b.position.y, before, after: b.velocity.toArray(),
        grounded: g.capy.grounded, carried: !!g.capy.carriedBy });
      return result;
    };
    try { for (let i = 0; i < 90; i++) g.tick(1 / 60, false); }
    finally { g.condor.update = raw; }
    return { chapter: g.biome.current, mounted: g.condor.mounted,
      water: g.rio.isOverWater(b.position.x, b.position.z),
      rows, final: { p: b.position.toArray(), v: b.velocity.toArray(),
        swimming: g.capy.swimming, error: g.state.lastError || null } };
  });
  assert.equal(report.chapter, 'rio');
  assert.equal(report.mounted, false);
  assert.ok(report.rows.length >= 3, 'release reached the swim controller');
  const first = report.rows[0];
  assert.equal(first.carried, false);
  assert.ok(first.y < 0 && first.y > -5, 'water entry was above seabed');
  assert.deepEqual(first.after, first.before, 'condor did not overwrite swim velocity on entry');
  assert.ok(report.rows.every(r => r.after.every(Number.isFinite)), 'finite water trajectory');
  assert.equal(report.final.error, null);
  assert.deepEqual(harness.metadata.errors, []);
  await harness.result('homecoming-condor-water', { ...report, metadata: harness.metadata,
    scope: 'Actual Rio engine and real condor mount/release; post-release landing position and velocity controlled.' });
  console.log(JSON.stringify({ waterRows: report.rows.length, first, final: report.final, errors: harness.metadata.errors }));
} finally { await harness.close(); }
