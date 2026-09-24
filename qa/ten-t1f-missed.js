async page => {
  // T1f THE MISSED-HER BEAT: board at the kerb, let her pull away, then WALK off the tail with a
  // real key and let go. Does the line come once, does the paper say when she is back, and does
  // the estimate hold (t + nextIn should stay flat while she climbs, turns and comes back)?
  // Rung pinned to 3 (fast) — the rung the review played at.
  const NAME = 'ten-t1f-missed'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 2 })) } catch (e) {} })
  await page.goto('http://localhost:5196/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  const out = { rows: [], toasts: [] }
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === 'cali') break
    await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('cali') }); await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  // every toast, by text, as it lands
  await page.evaluate(() => { const g = window.__capy; window.__t1fToasts = []; const o = g.toast; g.toast = function (s) { window.__t1fToasts.push({ t: +g.state.time.toFixed(1), s: String(s) }); return o.apply(this, arguments) } })
  out.place = await page.evaluate(() => window.__capy.cali.roofPlace(0))
  const snap = async () => page.evaluate(() => { const g = window.__capy, c = g.cali.chivaDebug(), p = g.capy.position
    const dx = p.x - c.x, dz = p.z - c.z, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw)
    const e = document.querySelector('.capyui-clue')
    return { t: +g.state.time.toFixed(1), st: c.st, s: c.s, onRoof: c.onRoof, lz: +(dx * sn + dz * cs).toFixed(2), held: c.held, missed: c.missed,
             nx: +(+g.cali.nextIn('chiva-mirador')).toFixed(1), clue: e ? e.textContent : null } })
  // wait for her to be rolling past s 20
  for (let k = 0; k < 80; k++) { await page.waitForTimeout(400); const r = await snap(); if (r.s > 20) { out.rows.push(r); break } }
  // walk off the tail: S is toward the camera, which rides behind her
  await page.keyboard.down('s');
  for (let k = 0; k < 8; k++) { await page.waitForTimeout(400); out.rows.push(await snap()) }
  await page.keyboard.up('s')
  const t0 = Date.now()
  let shot = false
  while (Date.now() - t0 < 120000) {
    await page.waitForTimeout(1500)
    const r = await snap(); out.rows.push(r)
    if (!shot && r.missed > 0) { shot = true; await page.waitForTimeout(600); await page.screenshot({ path: 'qa/' + NAME + '-line.png' }) }
    if (r.st === 'parked') break
  }
  await page.screenshot({ path: 'qa/' + NAME + '-end.png' })
  out.toasts = await page.evaluate(() => window.__t1fToasts)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
