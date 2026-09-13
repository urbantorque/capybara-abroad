async page => {
  const TAG = 'l6-f2-gull'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { window.__capy.completeTask('bin-chicken', true) })
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const ev = async (f, a) => page.evaluate(f, a)
  const out = { rows: [] }
  await ev(() => window.__capy.hud.cross('manly')); await page.waitForTimeout(9000)
  const g0 = await ev(() => { const t = window.__capy.manly.gullAt(); return [t.x, t.y, t.z] })
  const y = await ev(g => window.__capy.manly.terrainHeight(g[0] + 1.5, g[2] + 1.5), g0)
  await put(g0[0] + 1.5, y + 0.6, g0[2] + 1.5); await page.waitForTimeout(800); out.gull = [g0, y]
  for (let k = 0; k < 3; k++) { await tap('KeyQ', 100); await page.waitForTimeout(2200); out.rows.push(['wheek', k, await ev(() => { const d = window.__capy.herdDebug().kinds[0]; return [d.led, d.heard, d.looking] })]) }
  // walk a few steps so the trail exists and a led bird comes down to it, then loaf
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW')
  for (let k = 0; k < 12; k++) { await page.waitForTimeout(1000); out.rows.push(['loaf', k, await ev(() => { const d = window.__capy.perchDebug(); const h = window.__capy.herdDebug().kinds[0]; return [d.on, +d.loafT.toFixed(1), d.kinds[0].near, h.led, d.off] })]) }
  const pc = await ev(() => window.__capy.perchCount())
  const bz = await ev(() => window.__capy.manly.bank().z)
  await put(0, -0.3, bz - 12); await page.waitForTimeout(3000)
  out.rows.push(['result', pc, await ev(() => window.__capy.perchCount()), await ev(() => window.__capy.taskDone('gull-out-back')), await ev(() => window.__capy.capy.swimming), await ev(() => window.__capy.state.lastError || null)])
  if (pc) await page.screenshot({ path: 'qa/l6-f2-gull.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
