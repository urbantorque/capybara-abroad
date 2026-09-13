async page => {
  // THE WINDOW (L6, F2): the naive stand at each of the five clocked movers —
  // teleport to the row's own hint target, stand there with the input the row
  // wants (a wheek every 3 s in Kyoto, a hop every 2 s in Cali, nothing in the
  // Pantanal and the cave, the tiller held in Antarctica), and wait one cycle.
  // Records the tick, the live line's text while waiting, and lastError.
  const TAG = 'l6-f2-windows'
  const W = [
    { b: 'kyoto',     id: 'heron-lift',   key: 'KeyQ',   every: 3000, wait: 40000 },
    { b: 'cali',      id: 'kite-dive',    key: 'Space',  every: 1500, wait: 80000 },
    { b: 'pantanal',  id: 'jabiru-home',  key: null,     every: 0,    wait: 40000 },
    { b: 'cave',      id: 'the-big-drip', key: null,     every: 0,    wait: 82000 },
    { b: 'antarctic', id: 'the-calving',  key: 'KeyE',   every: 0,    wait: 70000 },
  ]
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => window.__capy.state.started), rows: [] }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  for (const w of W) {
    await page.evaluate(x => window.__capy.hud.cross(x), w.b); await page.waitForTimeout(9000)
    const s0 = await page.evaluate(w => {
      const g = window.__capy
      if (g.biome.current !== w.b) return { skip: 'biome ' + g.biome.current }
      const h = g.hintTarget(w.id)
      if (!h) return { skip: 'no-target' }
      // a hint point may carry no y (hintAt(x, z)); the live biome's own
      // terrain is the floor there
      const api = g[w.b]
      let y = typeof h.y === 'number' && h.y === h.y ? h.y : NaN
      if (y !== y && api && typeof api.terrainHeight === 'function') y = api.terrainHeight(h.x, h.z)
      if (y !== y) y = 0
      const b = g.capy.body
      // the heron's arrow is the bird: stand off it, as the clue says
      const ox = w.b === 'kyoto' ? -11 : 0
      b.position.set(h.x + ox, y + 0.8, h.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      return { ok: true, h: [+h.x.toFixed(1), +y.toFixed(1), +h.z.toFixed(1)] }
    }, w)
    if (!s0.ok) { out.rows.push([w.b, w.id, s0.skip]); continue }
    // Antarctica: the tiller is a press of E at the boat, and the boat is where
    // the arrow points before you are at it; take the helm first, then drive
    // her to the face and hold the ring.
    if (w.b === 'antarctic') {
      await page.evaluate(() => { const g = window.__capy, h = g.antarctic.boat.helm, b = g.capy.body; b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
      await page.waitForTimeout(800); await page.keyboard.press('KeyE'); await page.waitForTimeout(500)
      const helm = await page.evaluate(() => window.__capy.antarctic.boat.atHelm)
      out.rows.push([w.b, 'helm', helm])
      // the boat is the animal's ride body at the helm: put her thirty metres
      // off the face (the same trick the orca probe's podForce plays on the pod)
      await page.evaluate(() => { const g = window.__capy; const f = g.antarctic.calveFace; g.antarctic.boatForce(f.x + 32, f.z) })
      await page.waitForTimeout(1500)
      out.rows.push([w.b, 'boatAt', await page.evaluate(() => { const b = window.__capy.antarctic.boat.position; return [+b.x.toFixed(1), +b.z.toFixed(1)] })])
    }
    const t0 = Date.now(); let ticked = false; const lines = []; let shot = false
    while (Date.now() - t0 < w.wait) {
      if (w.key && w.every) await tap(w.key, 120)
      await page.waitForTimeout(w.every || 1000)
      const st = await page.evaluate(w => {
        const g = window.__capy
        const el = document.querySelector('.capyui-rec')
        const on = el && el.classList.contains('on')
        return { done: g.taskDone(w.id), line: on ? (document.querySelector('.capyui-recnow').textContent + ' | ' + document.querySelector('.capyui-recbest').textContent) : '',
                 err: g.state.lastError || null, p: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] }
      }, w)
      if (st.line && (lines.length === 0 || lines[lines.length - 1] !== st.line)) lines.push(st.line)
      if (st.line && !shot && /goes in|comes in|comes down in/.test(st.line)) { shot = true; await page.screenshot({ path: 'qa/l6-f2-window-' + w.b + '.png' }) }
      if (st.err) { out.rows.push([w.b, w.id, 'ERR', st.err]); break }
      if (st.done) { ticked = true; out.rows.push([w.b, w.id, 'TICK at ' + Math.round((Date.now() - t0) / 1000) + ' s', st.p]); break }
    }
    if (!ticked) out.rows.push([w.b, w.id, 'no tick in ' + Math.round(w.wait / 1000) + ' s', s0.h])
    out.rows.push([w.b, 'lines', lines.slice(0, 6), lines.length])
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
