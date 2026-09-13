async page => {
  // The five rows qa/l6-f2-rows.js could not drive first time, with the state
  // each one turned on: the boat's speed, the herd's hearing, the perch's
  // reach, the lane's direction, the slide.
  const TAG = 'l6-f2-rows2'
  const TEACHERS = ['bin-chicken', 'salsa-dance', 'glacier-run', 'acrobats', 'driftseed', 'bamboo-climb', 'gather', 'the-crossing', 'cross-the-road',
                    'manly-voyage', 'first-dive', 'sunrise']
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(T => { for (const t of T) window.__capy.completeTask(t, true) }, TEACHERS)
  await page.waitForTimeout(1200)
  const out = { rows: [] }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const done = async id => page.evaluate(id => window.__capy.taskDone(id), id)
  const ev = async (f, a) => page.evaluate(f, a)
  const gy = async (b, x, z) => page.evaluate(([b, x, z]) => { const a = window.__capy[b]; return a && typeof a.terrainHeight === 'function' ? a.terrainHeight(x, z) : 0 }, [b, x, z])
  const cross = async b => { await ev(b => window.__capy.hud.cross(b), b); await page.waitForTimeout(9000) }
  const aim = async (mx, mz) => {
    const want = Math.atan2(-mx, -mz)
    for (let k = 0; k < 8; k++) {
      const have = await ev(() => window.__capy.input.camYaw)
      let d = want - have; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI
      if (Math.abs(d) < 0.06) return +have.toFixed(2)
      await page.mouse.move(640, 380); await page.mouse.down()
      await page.mouse.move(640 - d / 0.005 * 0.5, 380, { steps: 6 }); await page.mouse.up()
      await page.waitForTimeout(400)
    }
    return 'aim failed ' + (await ev(() => +window.__capy.input.camYaw.toFixed(2)))
  }
  const pos = async () => ev(() => { const p = window.__capy.capy.position; return [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] })
  const rec = async (b, id, how) => { out.rows.push([b, id, (await done(id)) ? 'TICK' : 'no', how, await ev(() => window.__capy.state.lastError || null)]) }

  // ---- the Quay ---------------------------------------------------------
  {
    await cross('quay')
    await ev(() => { const g = window.__capy, h = g.quay.boat.helm, b = g.capy.body; b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
    await page.waitForTimeout(800); await tap('KeyE', 150); await page.waitForTimeout(500)
    const sp = []
    await page.keyboard.down('KeyW')
    for (let k = 0; k < 18; k++) { await page.waitForTimeout(1000); sp.push(await ev(() => +window.__capy.quay.boat.speed.toFixed(1))) }
    await page.keyboard.up('KeyW')
    await rec('quay', 'cap-at-the-helm', 'worn ' + await ev(() => window.__capy.capy.worn) + ' helm ' + await ev(() => window.__capy.capy.atHelm) + ' speeds ' + sp.join(','))
  }
  // ---- Rio --------------------------------------------------------------
  {
    await cross('rio')
    const hd = await ev(() => { const h = window.__capy.rio.selaronHead(); return [h.x, h.z] })
    const y = await gy('rio', hd[0], hd[1] - 2)
    await put(hd[0], y + 0.8, hd[1] - 2); await page.waitForTimeout(800)
    const yaw = await aim(0, -1)
    const trail = [await pos()]
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(700); trail.push(await pos()); await page.keyboard.down('KeyG')
    let slid = 0
    for (let k = 0; k < 40; k++) { await page.waitForTimeout(100); if (await ev(() => window.__capy.capy.sliding)) slid++; if (k % 10 === 9) trail.push(await pos()) }
    await page.keyboard.up('KeyG'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
    await rec('rio', 'selaron-belly', 'yaw ' + yaw + ' sliding ' + slid + ' trail ' + JSON.stringify(trail))
  }
  // ---- Iceland ----------------------------------------------------------
  {
    await cross('iceland')
    const m = await ev(() => window.__capy.iceland.sheepMoor)
    await put(m.x, await gy('iceland', m.x, m.z) + 0.8, m.z); await page.waitForTimeout(1500)
    const hd0 = await ev(() => { const d = window.__capy.herdDebug(); return JSON.stringify(d).slice(0, 300) })
    await tap('KeyQ', 100); await page.waitForTimeout(2500)
    const n = await ev(() => window.__capy.herdCount())
    const hd1 = await ev(() => { const d = window.__capy.herdDebug(); return JSON.stringify(d).slice(0, 300) })
    const s = await ev(() => window.__capy.iceland.spring)
    await put(s.x + 10, await gy('iceland', s.x + 10, s.z) + 0.8, s.z); await page.waitForTimeout(2500)
    await rec('iceland', 'sheep-to-the-spring', 'herd ' + n + ' before ' + hd0 + ' after ' + hd1)
  }
  // ---- Manly ------------------------------------------------------------
  {
    await cross('manly')
    // on the sand first: the nearest gull to the promenade is on an awning
    // (measured y 5.8 over ground 2.6, `near` 6.2 — out of the perch's reach)
    const ca = await ev(() => window.__capy.manly.castle)
    await put(ca.x, await gy('manly', ca.x, ca.z) + 0.6, ca.z); await page.waitForTimeout(700)
    const g = await ev(() => { const t = window.__capy.manly.gullAt(); return t && [+t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1)] })
    const y = await gy('manly', g[0] + 1.5, g[2] + 1.5)
    await put(g[0] + 1.5, y + 0.6, g[2] + 1.5); await page.waitForTimeout(700)
    await tap('KeyQ', 100); await page.waitForTimeout(1500); await tap('KeyQ', 100); await page.waitForTimeout(1500)
    const h1 = await ev(() => { const d = window.__capy.herdDebug(); return JSON.stringify(d).slice(0, 300) })
    await page.waitForTimeout(6000)
    const pd = await ev(() => { const d = window.__capy.perchDebug(); return JSON.stringify(d).slice(0, 300) })
    await rec('manly', 'gull-out-back', 'gull ' + JSON.stringify(g) + ' ground ' + y.toFixed(1) + ' herd ' + h1 + ' perch ' + pd)
  }
  // ---- Hanoi ------------------------------------------------------------
  {
    await cross('hanoi')
    const c = await ev(() => { const p = window.__capy.hanoi.crossing(); return [p.x, p.z] })
    let how = ''
    for (const [mx, mz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      await put(c[0] - mx * 9, 0.8, c[1] - mz * 9); await page.waitForTimeout(600)
      const yaw = await aim(mx, mz)
      await page.keyboard.down('KeyW'); await page.waitForTimeout(7000); await page.keyboard.up('KeyW')
      const st = await ev(() => { const g = window.__capy; const p = g.capy.position; return [g.capy.committed, +p.x.toFixed(1), +p.z.toFixed(1), g.taskDone('cross-the-road') ? 'crossed' : '-', g.taskDone('right-of-way')] })
      how += '[' + mx + ',' + mz + ' yaw ' + yaw + '] ' + st.join('/') + ' '
      if (st[4]) break
      await page.waitForTimeout(1500)
    }
    await rec('hanoi', 'right-of-way', how)
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
