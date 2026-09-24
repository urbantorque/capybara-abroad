async page => {
  // T1f THE CHIVA HOLDS ON: roofPlace(0) on the parked bus, NO input, and where is the animal
  // when she reaches s = 177 (the reviewer's fall-off ride)? PF pins the governor through the
  // prefs file: 1 = pretty (rung 0), 2 = fast (rung 3). OFF = true runs it with noChivaHold set.
  const PF = 2, NAME = 'ten-t1f-r3-off', OFF = true
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(pf => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: pf })) } catch (e) {} }, PF)
  await page.goto('http://localhost:5196/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  const out = { pf: PF, off: OFF, rows: [] }
  out.started = await page.evaluate(() => !!window.__capy.state.started)
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === 'cali') break
    await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('cali') }); await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(off => { window.__capy.state.noChivaHold = off }, OFF)
  out.place = await page.evaluate(() => window.__capy.cali.roofPlace(0))
  const t0 = Date.now()
  let shot = false, offShot = false
  while (Date.now() - t0 < 150000) {
    await page.waitForTimeout(500)
    const r = await page.evaluate(() => { const g = window.__capy, c = g.cali.chivaDebug(), p = g.capy.position
      const dx = p.x - c.x, dz = p.z - c.z, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw)
      const nx = typeof g.cali.nextIn === 'function' ? g.cali.nextIn('chiva-mirador') : null
      return { t: +g.state.time.toFixed(1), st: c.st, s: c.s, v: c.v, onRoof: c.onRoof, rung: g.state.perfRung,
               lx: +(dx * cs - dz * sn).toFixed(2), lz: +(dx * sn + dz * cs).toFixed(2), dy: +(p.y - c.y).toFixed(2),
               hits: c.hits, held: c.held, missed: c.missed, nx: nx === null ? null : +(+nx).toFixed(1) } })
    out.rows.push(r)
    if (!offShot && !r.onRoof && r.st !== 'parked') {
      offShot = true
      await page.waitForTimeout(1500)
      await page.screenshot({ path: 'qa/' + NAME + '-missed.png' })
      out.paperMissed = await page.evaluate(() => { const e = document.querySelector('.capyui-clue'); return e ? { clue: e.textContent, card: (e.parentElement && e.parentElement.innerText || '').slice(0, 300) } : null })
    }
    if (!shot && r.s > 120) { shot = true; await page.screenshot({ path: 'qa/' + NAME + '-ride.png' }) }
    if (r.s >= 177 || r.st === 'arrived') break
  }
  out.end = out.rows[out.rows.length - 1]
  out.offAt = (out.rows.find(r => !r.onRoof) || null)
  out.paper = await page.evaluate(() => { const e = document.querySelector('.capyui-clue'); return e ? { clue: e.textContent, card: (e.parentElement && e.parentElement.innerText || '').slice(0, 300) } : null })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.screenshot({ path: 'qa/' + NAME + '-end.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
