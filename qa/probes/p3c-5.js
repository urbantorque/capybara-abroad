async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    window.__log = []
    const t0 = g.toast
    g.toast = function (s) { window.__log.push(['toast', s, +g.cali.night().toFixed(2), +g.cali.rideProgress().toFixed(2), +performance.now().toFixed(0)]); return t0.apply(g, arguments) }
    g.biome.switchTo('cali')
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const c = g.cali, b = g.capy.body
    const stick = () => { const a = c.chivaAt(); b.position.set(a.x, a.y + 4.05, a.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    stick()
    for (let i = 0; i < 12000; i++) {
      if (!c.onChiva()) stick()
      g.tick(1 / 60, false)
      if (c.rideProgress() > 0.55) break
    }
    window.__stick = 1
    const loop = () => { if (!window.__stick) return; if (!c.onChiva() && c.chivaState() !== 'arrived') stick(); requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  })
  const shots = []
  for (let k = 0; k < 14; k++) {
    await page.waitForTimeout(5000)
    const st = await page.evaluate(() => { const c = window.__capy.cali; return { p: +c.rideProgress().toFixed(3), s: c.chivaState(), n: +c.night().toFixed(2) } })
    shots.push(st)
    if (st.s === 'arrived') { await page.screenshot({ path: 'qa/p3c-arrive.png' }); break }
    if (st.p > 0.90 && !shots.pre) { shots.pre = 1; await page.screenshot({ path: 'qa/p3c-pre.png' }) }
  }
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'qa/p3c-arrive2.png' })
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/p3c-arrive3.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.cali
    window.__stick = 0
    return { log: window.__log, prog: +c.rideProgress().toFixed(3), state: c.chivaState(), night: c.night(),
      skyward: +c.skyward().toFixed(2), task: g.taskDone('chiva-mirador'),
      capy: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)],
      cam: [+g.camera.position.x.toFixed(1), +g.camera.position.y.toFixed(1), +g.camera.position.z.toFixed(1)],
      err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p3c5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, { out, shots })
}
