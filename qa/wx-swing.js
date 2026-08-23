// THE MICRO-ENVIRONMENT MUST NOT CHANGE WHAT HOUR IT IS.
//
// The one test the whole pass turns on. For every chapter, force a shower so
// the FULL range of the micro-state is exercised (the calm half is not the
// interesting half), then record how far the sun, the hemisphere, the ambient,
// the far plane and the bloom actually travel. A swing that reads as weather
// is under about a third; a swing over half is a different time of day, and if
// any row here shows one the constants in weather.js are wrong.
//
// Run one BATCH at a time — a single page.evaluate over seventeen chapters is
// a quarter of a million ticks and dies on "Execution context was destroyed".
//
//   window.__wxSwing(['sydney','pasto','quay','kyoto','cali'])
window.__wxSwing = function (names, secs) {
  const g = window.__capy, W = g.weather;
  g.state.started = true;
  const S = secs || 150;
  const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow);
  const hemi = g.scene.children.find(o => o.isHemisphereLight);
  const amb = g.scene.children.find(o => o.isAmbientLight);
  const rows = {};
  for (const n of names) {
    const b = W.rowOf(n);
    W.set(n, { rain: { odds: 1, peak: b.rain.peak, hold: b.rain.hold, gap: 4 } });
    g.biome.switchTo(n);
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    let s0 = 1e9, s1 = -1e9, h0 = 1e9, h1 = -1e9, a0 = 1e9, a1 = -1e9;
    let f0 = 1e9, f1 = -1e9, b0 = 1e9, b1 = -1e9, rmax = 0;
    for (let i = 0; i < 60 * S; i++) {
      g.tick(1 / 60, false);
      s0 = Math.min(s0, sun.intensity); s1 = Math.max(s1, sun.intensity);
      h0 = Math.min(h0, hemi.intensity); h1 = Math.max(h1, hemi.intensity);
      a0 = Math.min(a0, amb.intensity); a1 = Math.max(a1, amb.intensity);
      if (g.scene.fog) { f0 = Math.min(f0, g.scene.fog.far); f1 = Math.max(f1, g.scene.fog.far); }
      const pp = g.post.params; b0 = Math.min(b0, pp.bloom); b1 = Math.max(b1, pp.bloom);
      rmax = Math.max(rmax, W.drizzle());
    }
    rows[n] = {
      rain: +rmax.toFixed(2),
      sun: [+s0.toFixed(2), +s1.toFixed(2)], sunSwing: +((s1 - s0) / Math.max(0.01, s1)).toFixed(2),
      hemi: [+h0.toFixed(2), +h1.toFixed(2)], hemiSwing: +((h1 - h0) / Math.max(0.01, h1)).toFixed(2),
      amb: [+a0.toFixed(2), +a1.toFixed(2)],
      fogFar: [Math.round(f0), Math.round(f1)], fogSwing: +((f1 - f0) / Math.max(1, f1)).toFixed(2),
      bloom: [+b0.toFixed(2), +b1.toFixed(2)],
    };
  }
  return rows;
};
