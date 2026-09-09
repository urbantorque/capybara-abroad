// WHAT THE MICRO-ENVIRONMENT COSTS, MEASURED AT ITS WEATHER.
//
// Marrakech's note in CONTRACT.md is the rule this obeys: a chapter that
// changes its weather must be measured AT its weather, because 200 star
// spheres and a wall of sand are visible=false at noon and every measurement
// that chapter ever had was 10 000 triangles under its real maximum. The same
// trap is now live in seventeen places — the rain field draws nothing at all
// until it rains — so every number here is taken at a forced shower peak.
//
// Draw calls are read the way the contract says they must be: autoReset off,
// reset, ONE tick, read. Reading straight after tick() returns 1, because the
// post pass resets the counter.
window.__wxPerf = function (names) {
  const g = window.__capy, W = g.weather;
  g.state.started = true;
  const rows = {};
  const info = g.renderer.info;
  for (const n of names) {
    const b = W.rowOf(n);
    g.biome.switchTo(n);
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    // --- dry: whatever this chapter is when nothing is falling ---
    info.autoReset = false; info.reset();
    g.tick(1 / 60, true);
    const dry = { calls: info.render.calls, tris: info.render.triangles };
    info.autoReset = true;
    // --- and at the peak of a forced shower ---
    // hold long enough that the envelope's peak (u = 0.22) is reachable, then
    // run exactly to it.
    W.set(n, { rain: { odds: 1, peak: b.rain.peak, hold: 400, gap: 1 } });
    for (let i = 0; i < 60 * 90; i++) g.tick(1 / 60, false);
    info.autoReset = false; info.reset();
    g.tick(1 / 60, true);
    const wet = { calls: info.render.calls, tris: info.render.triangles };
    info.autoReset = true;
    let motes = 0, rainQ = 0;
    g.scene.traverse(o => {
      if (o.isInstancedMesh && o.renderOrder === 6 && o.count > 0) {
        if (o.geometry.attributes.position.count === 24) rainQ = o.count; else motes = o.count;
      }
    });
    rows[n] = {
      rain: +W.drizzle().toFixed(2),
      calls: [dry.calls, wet.calls], callDelta: wet.calls - dry.calls,
      tris: [dry.tris, wet.tris], triDelta: wet.tris - dry.tris,
      motes: motes, streaks: rainQ,
    };
  }
  return rows;
};
