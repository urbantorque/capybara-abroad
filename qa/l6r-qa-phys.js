async page => {
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => { window.__capy.hud.cross(name) }, n)
    await page.waitForTimeout(6000)
    await page.evaluate(() => {
      const g = window.__capy, w = g.world, bp = w.broadphase
      const S = { sub: 0, bpMs: [], nbc: 0, nbcCalls: [], narMs: [], solMs: [], intMs: [], frames: 0, contacts: [] }
      const rawIS = w.internalStep, rawCP = bp.collisionPairs, rawNBC = bp.needBroadphaseCollision, rawGC = w.narrowphase.getContacts, rawSolve = w.solver.solve
      let nbc = 0
      bp.needBroadphaseCollision = function (a, b) { nbc++; return rawNBC.call(this, a, b) }
      bp.collisionPairs = function (world, p1, p2) { nbc = 0; const t = performance.now(); const o = rawCP.call(this, world, p1, p2); S.bpMs.push(performance.now() - t); S.nbcCalls.push(nbc); return o }
      w.narrowphase.getContacts = function () { const t = performance.now(); const o = rawGC.apply(this, arguments); S.narMs.push(performance.now() - t); return o }
      w.solver.solve = function () { const t = performance.now(); const o = rawSolve.apply(this, arguments); S.solMs.push(performance.now() - t); return o }
      w.internalStep = function (dt) { const t = performance.now(); const o = rawIS.call(w, dt); S.intMs.push(performance.now() - t); S.sub++; S.contacts.push(w.contacts.length); return o }
      const rawTick = g.tick
      g.tick = function (dt, r) { const o = rawTick.call(g, dt, r); S.frames++; return o }
      g.__l6b = { S, rawIS, rawCP, rawNBC, rawGC, rawSolve, rawTick }
    })
    await page.waitForTimeout(5000)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, w = g.world, bp = w.broadphase, L = g.__l6b, S = L.S
      w.internalStep = L.rawIS; bp.collisionPairs = L.rawCP; bp.needBroadphaseCollision = L.rawNBC; w.narrowphase.getContacts = L.rawGC; w.solver.solve = L.rawSolve; g.tick = L.rawTick
      const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) }
      const mean = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0
      let stat = 0, kin = 0, dyn = 0, dynAwake = 0, hf = 0, tri = 0, shapes = 0
      for (const b of w.bodies) {
        if (b.type === 2) stat++; else if (b.type === 4) kin++; else { dyn++; if (b.sleepState !== 2) dynAwake++ }
        for (const s of b.shapes) { shapes++; if (s.type === 512) hf++; if (s.type === 256) tri++ }
      }
      return {
        biome: g.biome.current, ok: g.biome.current === name, frames: S.frames, substeps: S.sub, subPerFrame: +(S.sub / Math.max(1, S.frames)).toFixed(2),
        internalMs: mean(S.intMs), internalP95: q(S.intMs, 0.95), broadphaseMs: mean(S.bpMs), narrowMs: mean(S.narMs), solveMs: mean(S.solMs),
        nbcPerSub: Math.round(mean(S.nbcCalls)), contacts: Math.round(mean(S.contacts)), contactsMax: q(S.contacts, 1),
        bodies: w.bodies.length, stat, kin, dyn, dynAwake, shapes, hf, tri, lastError: g.state.lastError || null,
      }
    }, n)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-phys.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
