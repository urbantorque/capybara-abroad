// THE FIRST VERSION OF THIS MEASUREMENT WAS WRONG AND SAID +113 DRAW CALLS.
//
// It compared a dry frame against a frame ninety seconds later, and ninety
// seconds of Kowloon is a Symphony of Lights cue, two buses and a crowd — so
// the delta was mostly the chapter changing, not the weather arriving. The
// tell was Sydney, which reported MINUS six calls in a chapter where it never
// started raining at all.
//
// A cost is the difference between two ADJACENT frames with one thing changed,
// so: hold at the shower's peak, tick and read with the two weather fields
// visible, hide exactly those two objects, tick and read again. Nothing else
// in the world advances more than one frame between the two.
window.__wxPerf2 = function (names) {
  const g = window.__capy, W = g.weather;
  g.state.started = true;
  const info = g.renderer.info;
  const rows = {};
  function fields() {
    const out = [];
    g.scene.traverse(o => { if (o.isInstancedMesh && o.renderOrder === 6) out.push(o); });
    return out;
  }
  function read() {
    info.autoReset = false; info.reset();
    g.tick(1 / 60, true);
    const r = { calls: info.render.calls, tris: info.render.triangles };
    info.autoReset = true;
    return r;
  }
  for (const n of names) {
    const b = W.rowOf(n);
    g.biome.switchTo(n);
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    W.set(n, { rain: { odds: 1, peak: b.rain.peak, hold: 400, gap: 1 } });
    for (let i = 0; i < 60 * 88; i++) g.tick(1 / 60, false);
    const F = fields();
    const on = read();
    const was = F.map(o => o.visible);
    F.forEach(o => { o.visible = false; });
    const off = read();
    F.forEach((o, i) => { o.visible = was[i]; });
    let motes = 0, streaks = 0;
    F.forEach(o => {
      if (!o.count) return;
      if (o.geometry.attributes.position.count === 24) streaks = o.count; else motes = o.count;
    });
    rows[n] = {
      rain: +W.drizzle().toFixed(2),
      chapterCalls: off.calls, chapterTris: off.tris,
      wxCalls: on.calls - off.calls, wxTris: on.tris - off.tris,
      motes: motes, streaks: streaks,
    };
  }
  return rows;
};
