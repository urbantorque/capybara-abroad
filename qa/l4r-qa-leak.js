async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  // count live audio sources BEFORE the first gesture so nothing escapes the hook
  await page.evaluate(() => {
    const P = BaseAudioContext.prototype;
    const live = new Set(); let made = 0;
    for (const k of ['createOscillator', 'createBufferSource', 'createConstantSource']) {
      const raw = P[k];
      P[k] = function () { const n = raw.apply(this, arguments); made++; live.add(n); n.addEventListener('ended', () => live.delete(n)); return n; };
    }
    const rawStop = AudioScheduledSourceNode.prototype.stop;
    AudioScheduledSourceNode.prototype.stop = function () { const n = this; setTimeout(() => live.delete(n), 1500); return rawStop.apply(this, arguments); };
    window.__l4audio = { live, get made() { return made; } };
    // timers
    let ivs = 0; const rawSI = window.setInterval, rawCI = window.clearInterval; const ivLive = new Set();
    window.setInterval = function () { const id = rawSI.apply(this, arguments); ivs++; ivLive.add(id); return id; };
    window.clearInterval = function (id) { ivLive.delete(id); return rawCI.apply(this, arguments); };
    window.__l4iv = ivLive;
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  const snap = () => page.evaluate(() => {
    const g = window.__capy, R = g.renderer;
    let vis = 0, all = 0;
    g.scene.traverse(o => { all++; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; } if (v) vis++; });
    const kin = g.world.bodies.filter(b => b.type === 4).length;
    const dyn = g.world.bodies.filter(b => b.mass > 0).length;
    let hidden = 0, removed = 0, foreign = 0;
    for (const p of g.props) { if (!p) continue; if (p.removed) removed++; if (p.hidden) hidden++; if (p.biome && p.biome !== g.biome.current && !p.hidden && !p.removed) foreign++; }
    return {
      biome: g.biome.current, t: +g.state.time.toFixed(1),
      sceneChildren: g.scene.children.length, nodesAll: all, nodesVisible: vis,
      bodies: g.world.bodies.length, kin, dyn,
      constraints: g.world.constraints.length, contacts: g.world.contacts.length,
      props: g.props.length, propsRemoved: removed, propsHidden: hidden, propsForeign: foreign,
      npcs: g.npcs.length, locals: (g.locals || []).length,
      geometries: R.info.memory.geometries, textures: R.info.memory.textures, programs: R.info.programs.length,
      audioLive: window.__l4audio ? window.__l4audio.live.size : -1, audioMade: window.__l4audio ? window.__l4audio.made : -1,
      intervals: window.__l4iv ? window.__l4iv.size : -1,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      lastError: g.state.lastError || null,
      timeScale: g.state.timeScale, paused: g.state.paused,
    };
  });
  const route = ['kyoto', 'venice', 'hanoi', 'monaco', 'sydney', 'kyoto', 'venice', 'hanoi', 'monaco', 'sydney', 'kyoto', 'venice', 'hanoi', 'monaco', 'sydney'];
  const rows = [await snap()];
  for (const b of route) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, b);
    await page.waitForTimeout(5000);
    // a short walk so movers and sounds start, then settle
    await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
    await page.waitForTimeout(2500);
    rows.push(await snap());
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-leak.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, rows);
}
