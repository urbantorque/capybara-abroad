// D3 hardware-browser CPU gate cost, excluding inherited HUD/layout/GPU work.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const h = await openHarness();
try {
  await h.start();
  const report = await h.page.evaluate(async () => {
    const source = await (await fetch('/src/systems.js')).text();
    const helper = source.match(/function sysEarnedLive\([^]*?\n\}/)[0];
    const start = source.indexOf('const earnedBio = game.biome');
    const block = source.slice(start, source.indexOf('const earnedChanged', start));
    const s = await import('/src/shared.js');
    const game = { state: { noEarnedFocus: false, perfRung: 0 }, biome: { current: 'sydney' } };
    const step = new Function('game', 'chapterOf', `const sysWOW_LIVE_STALE=.7;
      ${helper}
      let wowEarnedId='opera-stage',wowEarnedBiome='sydney';
      const transBusy=false,taskRec={'opera-stage':{done:true,def:{chapter:1}}},wowLiveLine='THE ENCORE',wowLiveSince=0;
      return function(){${block};return earned;};`)(game, s.chapterOf);
    const rows = [];
    for (const mode of ['live', 'flag', 'rung']) {
      game.state.noEarnedFocus = mode === 'flag'; game.state.perfRung = mode === 'rung' ? 1 : 0;
      let sink = 0; for (let i = 0; i < 10000; i++) sink += Number(step());
      const times = [];
      for (let j = 0; j < 100; j++) {
        const t = performance.now();
        for (let i = 0; i < 10000; i++) sink += Number(step());
        times.push((performance.now() - t) / 10000);
      }
      times.sort((a, b) => a - b);
      rows.push({ mode, calls: 1010000, sink, medianMs: times[50], p95Ms: times[95] });
    }
    return { scope: 'Actual continuation eligibility block in a real hardware browser; excludes inherited HUD, style/layout, and GPU work.', rows };
  });
  await h.result('reimagine-encore-cost', { metadata: h.metadata, ...report });
  console.log(JSON.stringify(report, null, 2));
  for (const row of report.rows) {
    assert.equal(row.sink, row.mode === 'live' ? row.calls : 0);
    if (row.mode !== 'live') assert.ok(row.p95Ms <= .1, 'cut gate <=.1ms');
  }
  assert.deepEqual(h.metadata.errors, []);
} finally { await h.close(); }
