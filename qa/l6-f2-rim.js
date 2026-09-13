async page => {
  const TAG = 'l6-f2-rim'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { for (const t of ['bin-chicken', 'sunrise']) window.__capy.completeTask(t, true) })
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const ev = async (f, a) => page.evaluate(f, a)
  const out = { rows: [] }
  await ev(() => window.__capy.hud.cross('goreme')); await page.waitForTimeout(9000)
  out.worn = await ev(() => window.__capy.capy.worn)
  const c = await ev(() => { const t = window.__capy.goreme.catAt(); return [t.x, t.y, t.z] })
  await put(c[0] + 1.2, c[1] + 0.6, c[2] + 1.2); await page.waitForTimeout(800)
  for (let k = 0; k < 3; k++) { await tap('KeyQ', 100); await page.waitForTimeout(2200) }
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
  // the loaf takes ~7 s to come on after the walk and the cat ~3 s more (qa/l7-rim-dbg.js: perch at 10 s)
  out.wait = []
  for (let k = 0; k < 28; k++) {
    await page.waitForTimeout(1000)
    out.wait.push(await ev(() => { const g = window.__capy, c = g.capy, h = g.herdDebug(true).kinds[0], p = c.position; const ds = h.pts.map(q => +Math.hypot(q[0] - p.x, q[2] - p.z).toFixed(1)).sort((a, b) => a - b); return [+c.loaf.toFixed(2), +c.restT.toFixed(1), h.led, ds[0], g.perchCount()] }))
    if (await ev(() => window.__capy.perchCount())) break
    if (k === 13) await tap('KeyQ', 100)   // the company is on a 21 s clock; a player would ask again
  }
  out.perch = await ev(() => window.__capy.perchCount())
  out.herd = await ev(() => { const d = window.__capy.herdDebug().kinds[0]; return [d.led, d.heard] })
  // into the basket (walk in: a hop puts the cat off), then the burner
  const b = await ev(() => { const t = window.__capy.goreme.balloon(); return [t.x, t.y, t.z] })
  await put(b[0], b[1] + 0.8, b[2]); await page.waitForTimeout(1500)
  out.aboard = await ev(() => window.__capy.goreme.aboard())
  out.perch2 = await ev(() => window.__capy.perchCount())
  await page.keyboard.down('KeyE')
  const t0 = Date.now()
  let lastQ = Date.now()
  while (Date.now() - t0 < 170000) {
    await page.waitForTimeout(2000)
    // THE COMPANY IS ON A CLOCK (herdHOLD 21 s): a passenger gets down when it runs out, so the
    // ride wheeks every twelve seconds — the cat is at 0 m, well inside earshot
    if (Date.now() - lastQ > 12000) { await tap('KeyQ', 100); lastQ = Date.now() }
    const s = await ev(() => { const g = window.__capy.goreme; return [+g.altitude().toFixed(0), +g.sunUp().toFixed(2), window.__capy.perchCount(), window.__capy.taskDone('cap-at-the-rim'), window.__capy.capy.worn] })
    if (s[0] > 90) await page.keyboard.up('KeyE'); else await page.keyboard.down('KeyE')
    if ((Date.now() - t0) % 10000 < 2000) out.rows.push(s)
    if (s[3]) { out.rows.push(s); await page.screenshot({ path: 'qa/l6-f2-rim.png' }); break }
  }
  await page.keyboard.up('KeyE')
  out.err = await ev(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
