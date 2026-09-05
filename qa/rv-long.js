async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);

  // Instrument BEFORE the first chapter is entered by a key: audio node
  // creations, live timers, listener adds/removes, bus subscriptions.
  await page.evaluate(() => {
    const C = {
      audioNodes: 0, timersLive: new Set(), intervalsLive: new Set(),
      listenersAdded: 0, listenersRemoved: 0, busOn: 0, busOff: 0,
    };
    window.__rv = C;
    const P = (window.AudioContext || window.webkitAudioContext).prototype;
    for (const k of Object.getOwnPropertyNames(P)) {
      if (!/^create/.test(k) || typeof P[k] !== 'function') continue;
      const raw = P[k];
      P[k] = function () { C.audioNodes++; return raw.apply(this, arguments); };
    }
    const si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function () { const id = si.apply(window, arguments); C.intervalsLive.add(id); return id; };
    window.clearInterval = function (id) { C.intervalsLive.delete(id); return ci.call(window, id); };
    const st = window.setTimeout, ct = window.clearTimeout;
    window.setTimeout = function () {
      const args = Array.prototype.slice.call(arguments);
      const fn = args[0];
      let id;
      args[0] = function () { C.timersLive.delete(id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; };
      id = st.apply(window, args); C.timersLive.add(id); return id;
    };
    window.clearTimeout = function (id) { C.timersLive.delete(id); return ct.call(window, id); };
    const ael = EventTarget.prototype.addEventListener, rel = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function () { C.listenersAdded++; return ael.apply(this, arguments); };
    EventTarget.prototype.removeEventListener = function () { C.listenersRemoved++; return rel.apply(this, arguments); };
    const g = window.__capy;
    const on = g.events.on, off = g.events.off;
    g.events.on = function () { C.busOn++; return on.apply(g.events, arguments); };
    g.events.off = function () { C.busOff++; return off.apply(g.events, arguments); };
    // rAF frame-time sampler
    C.ft = [];
    let last = performance.now();
    const raf = () => { const n = performance.now(); C.ft.push(n - last); last = n; requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return true;
  });

  await page.keyboard.press('Digit1');
  await wait(5000);

  await page.evaluate(() => {
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
    let s = 20260905 >>> 0;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
    const held = new Set();
    window.__go = function () {
      window.__drive = setInterval(function () {
        if (rnd() < 0.11) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          const ev = held.has(k) ? 'keyup' : 'keydown';
          if (held.has(k)) held.delete(k); else held.add(k);
          window.dispatchEvent(new KeyboardEvent(ev, { code: k, bubbles: true }));
        }
      }, 16);
    };
    window.__stop = function () {
      clearInterval(window.__drive);
      for (const k of held) window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      held.clear();
    };
    return true;
  });

  const ALL = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi'];
  const rows = [];
  const snap = (name, lap) => page.evaluate(function (o) {
    const g = window.__capy, C = window.__rv;
    let objs = 0, meshes = 0, vis = 0;
    g.scene.traverse(x => { objs++; if (x.isMesh || x.isInstancedMesh) { meshes++; if (x.visible) vis++; } });
    const ft = C.ft.slice(-300).sort((a, b) => a - b);
    const med = ft.length ? ft[ft.length >> 1] : -1;
    const p95 = ft.length ? ft[Math.floor(ft.length * 0.95)] : -1;
    C.ft.length = 0;
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
    return {
      n: o.name, lap: o.lap, biome: g.biome.current,
      geos: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures,
      progs: g.renderer.info.programs ? g.renderer.info.programs.length : -1,
      objs: objs, meshes: meshes, visMeshes: vis,
      bodies: g.world.bodies.length, props: g.props.length, npcs: g.npcs.length,
      locals: g.locals ? g.locals.length : -1,
      dom: document.querySelectorAll('*').length,
      heapMB: mem, audioNodes: C.audioNodes,
      timers: C.timersLive.size, intervals: C.intervalsLive.size,
      lAdd: C.listenersAdded, lRem: C.listenersRemoved, busOn: C.busOn, busOff: C.busOff,
      ftMed: +med.toFixed(2), ftP95: +p95.toFixed(2),
      err: g.state.lastError ? String(g.state.lastError) : null,
    };
  }, { name, lap });

  for (let lap = 1; lap <= 2; lap++) {
    for (let i = 0; i < ALL.length; i++) {
      await page.evaluate(function (name) {
        const g = window.__capy;
        g.biome.switchTo(name);
        const sp = g.biome.spawnOf(name), b = g.capy.body;
        if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
        window.__go();
        return true;
      }, ALL[i]);
      await wait(7000);
      await page.evaluate(() => { window.__stop(); return true; });
      await wait(400);
      rows.push(await snap(ALL[i], lap));
    }
  }
  // a third look at Sydney after everything, idle
  await page.evaluate(function () {
    const g = window.__capy; g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney'), b = g.capy.body;
    if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
    return true;
  });
  await wait(6000);
  rows.push(await snap('sydney', 3));

  const out = { rows };
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=rv-long.json', { method: 'POST', body: s }), bl);
}
