async page => {
  // THE SECOND ASK (L6, F2): the directed drive for the rows the differential
  // probe (qa/l6-second-ask.js) and the window probe (qa/l6-f2-windows.js) do
  // not cover. Every teacher task is ticked silently first, so every skill and
  // costume is on; each row is then driven by teleport and keys and read back.
  const TAG = 'l6-f2-rows'
  const TEACHERS = ['bin-chicken', 'salsa-dance', 'glacier-run', 'acrobats', 'driftseed', 'bamboo-climb', 'gather', 'the-crossing', 'cross-the-road',
                    'manly-voyage', 'first-dive', 'sunrise']
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(T => { for (const t of T) window.__capy.completeTask(t, true) }, TEACHERS)
  await page.waitForTimeout(1200)
  const out = { rows: [], notes: [] }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const done = async id => page.evaluate(id => window.__capy.taskDone(id), id)
  const ev = async (f, a) => page.evaluate(f, a)
  const gy = async (b, x, z) => page.evaluate(([b, x, z]) => { const a = window.__capy[b]; return a && typeof a.terrainHeight === 'function' ? a.terrainHeight(x, z) : 0 }, [b, x, z])
  const cross = async b => { await ev(b => window.__capy.hud.cross(b), b); await page.waitForTimeout(9000) }
  // AIM THE CAMERA so that W walks along a world direction: W is input.z = -1,
  // which capybara.js turns into (-sin camYaw, -cos camYaw), so the yaw that
  // walks along (mx, mz) is atan2(-mx, -mz). The yaw is a mouse drag.
  const aim = async (mx, mz) => {
    const want = Math.atan2(-mx, -mz)
    for (let k = 0; k < 8; k++) {
      const have = await ev(() => window.__capy.input.camYaw)
      let d = want - have; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI
      if (Math.abs(d) < 0.06) return true
      await page.mouse.move(640, 380); await page.mouse.down()
      await page.mouse.move(640 - d / 0.005 * 0.5, 380, { steps: 6 }); await page.mouse.up()
      await page.waitForTimeout(400)
    }
    return false
  }
  const rec = async (b, id, how) => { out.rows.push([b, id, (await done(id)) ? 'TICK' : 'no', how, await ev(() => window.__capy.state.lastError || null)]) }

  // ---- Sydney: two ibis on the podium ----------------------------------
  {
    const h = await ev(() => { const t = window.__capy.hintTarget('ibis-parade'); return t && [t.x, t.z] })
    if (h) { await put(h[0] + 2, 0.8, h[1] + 2); await page.waitForTimeout(600); await tap('KeyQ', 100); await page.waitForTimeout(2500) }
    const n = await ev(() => window.__capy.herdCount())
    await put(0, 2.2, 1.5); await page.waitForTimeout(2500)
    await rec('sydney', 'ibis-parade', 'herd ' + n + ' then podium')
  }
  // ---- Pasto: an empanada onto the float --------------------------------
  {
    await cross('pasto')
    const e = await ev(() => { const g = window.__capy; const q = (g.props || []).find(p => p && p.type === 'empanada' && !p.removed && !p.held && p.body); return q ? [q.body.position.x, q.body.position.y, q.body.position.z] : null })
    if (e) { await put(e[0], e[1] + 0.6, e[2] + 0.4); await page.waitForTimeout(700); await tap('KeyE', 150); await page.waitForTimeout(600) }
    const held = await ev(() => { const h = window.__capy.capy.heldProp; return h ? h.type : null })
    const c = await ev(() => { const p = window.__capy.pasto.carroza(); return [p.x, p.y, p.z] })
    await put(c[0], c[1] + 1.55 + 0.6, c[2]); await page.waitForTimeout(1500)
    const aboard = await ev(() => { const g = window.__capy; const p = g.capy.position; const c = g.pasto.carroza(); return [+(p.y - c.y).toFixed(2), +Math.hypot(p.x - c.x, p.z - c.z).toFixed(2)] })
    await tap('KeyE', 150); await page.waitForTimeout(800)
    await rec('pasto', 'empanada-float', 'held ' + held + ' aboard ' + aboard.join('/'))
  }
  // ---- the Quay: the cap at the helm ------------------------------------
  {
    await cross('quay')
    const worn = await ev(() => window.__capy.capy.worn)
    await ev(() => { const g = window.__capy, h = g.quay.boat.helm, b = g.capy.body; b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
    await page.waitForTimeout(800); await tap('KeyE', 150); await page.waitForTimeout(500)
    const helm = await ev(() => window.__capy.capy.atHelm)
    await page.keyboard.down('KeyW'); await page.waitForTimeout(16000); await page.keyboard.up('KeyW')
    await rec('quay', 'cap-at-the-helm', 'worn ' + worn + ' helm ' + helm)
  }
  // ---- Rio: the flight on the belly -------------------------------------
  {
    await cross('rio')
    const hd = await ev(() => { const h = window.__capy.rio.selaronHead(); return [h.x, h.z] })
    const y = await gy('rio', hd[0], hd[1] - 2)
    await put(hd[0], y + 0.8, hd[1] - 2); await page.waitForTimeout(800)
    await aim(0, -1)
    await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.down('KeyG')
    let slid = 0
    for (let k = 0; k < 40; k++) { await page.waitForTimeout(100); if (await ev(() => window.__capy.capy.sliding)) slid++ }
    await page.keyboard.up('KeyG'); await page.keyboard.up('KeyW')
    await rec('rio', 'selaron-belly', 'sliding frames ' + slid + ' at ' + await ev(() => { const p = window.__capy.capy.position; return [+p.x.toFixed(1), +p.z.toFixed(1)].join(',') }))
  }
  // ---- Iceland: two sheep to the pool -----------------------------------
  {
    await cross('iceland')
    const m = await ev(() => window.__capy.iceland.sheepMoor)
    await put(m.x, await gy('iceland', m.x, m.z) + 0.8, m.z); await page.waitForTimeout(700)
    await tap('KeyQ', 100); await page.waitForTimeout(2500)
    const n = await ev(() => window.__capy.herdCount())
    const s = await ev(() => window.__capy.iceland.spring)
    await put(s.x + 10, await gy('iceland', s.x + 10, s.z) + 0.8, s.z); await page.waitForTimeout(2500)
    await rec('iceland', 'sheep-to-the-spring', 'herd ' + n + ' then pool')
  }
  // ---- Palawan: the cathedral in the snorkel ----------------------------
  {
    await cross('palawan')
    const worn = await ev(() => window.__capy.capy.worn)
    const c = await ev(() => window.__capy.palawan.cathedral)
    await put(c.x, -0.2, c.z); await page.waitForTimeout(800)
    await page.keyboard.down('KeyE'); await page.waitForTimeout(6500); await page.keyboard.up('KeyE')
    await rec('palawan', 'snorkel-cathedral', 'worn ' + worn + ' depth ' + await ev(() => +(window.__capy.capy.depth || 0).toFixed(2)))
  }
  // ---- Manly: out the back with a gull ----------------------------------
  {
    await cross('manly')
    const g = await ev(() => { const t = window.__capy.manly.gullAt(); return t && [t.x, t.y, t.z] })
    if (g) { await put(g[0] + 1.5, g[1] + 0.6, g[2] + 1.5); await page.waitForTimeout(700); await tap('KeyQ', 100); await page.waitForTimeout(1500); await tap('KeyQ', 100); await page.waitForTimeout(6000) }
    const pc = await ev(() => window.__capy.perchCount())
    const bz = await ev(() => window.__capy.manly.bank().z)
    await put(0, -0.3, bz - 12); await page.waitForTimeout(3000)
    await rec('manly', 'gull-out-back', 'perch ' + pc + ' then swam z ' + (bz - 12).toFixed(0) + ' perch now ' + await ev(() => window.__capy.perchCount()))
  }
  // ---- Hanoi: the crossing on right of way ------------------------------
  {
    await cross('hanoi')
    const c = await ev(() => { const g = window.__capy; const p = g.hanoi.crossing(); return [p.x, p.z] })
    // stand a kerb's width back from the lane centre, then walk straight
    // through it: the lane's own yaw is not published, so try +x then +z
    let how = ''
    for (const [mx, mz] of [[1, 0], [0, 1]]) {
      await put(c[0] - mx * 9, 0.8, c[1] - mz * 9); await page.waitForTimeout(600)
      await aim(mx, mz)
      await page.keyboard.down('KeyW'); await page.waitForTimeout(6500); await page.keyboard.up('KeyW')
      const st = await ev(() => { const g = window.__capy; const p = g.capy.position; return [g.capy.committed, +p.x.toFixed(1), +p.z.toFixed(1), g.taskDone('right-of-way')] })
      how += '[' + mx + ',' + mz + '] ' + st.join('/') + ' '
      if (st[3]) break
      await page.waitForTimeout(1500)
    }
    await rec('hanoi', 'right-of-way', how)
  }
  await page.screenshot({ path: 'qa/l6-f2-rows.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
