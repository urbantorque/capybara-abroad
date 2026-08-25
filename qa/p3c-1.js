async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, out = {}
    const toasts = []
    const t0 = g.toast
    g.toast = function (s) { toasts.push({ s: s, t: +tt.toFixed(1), n: +g.cali.night().toFixed(3) }); return t0.apply(g, arguments) }
    let tt = 0
    g.biome.switchTo('cali')
    for (let i = 0; i < 120; i++) { g.tick(1 / 60, false); tt += 1 / 60 }
    const c = g.cali, b = g.capy.body
    out.floor = c.floor; out.mirador = c.mirador; out.chiva = c.chiva; out.SPAWN = c.SPAWN
    out.state0 = c.chivaState(); out.night0 = c.night()
    // ---- A. stand on the dance floor for 90 s, chiva parked ----------------
    b.position.set(c.floor.x, c.terrainHeight(c.floor.x, c.floor.z) + 0.6, c.floor.z)
    b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 5400; i++) { g.tick(1 / 60, false); tt += 1 / 60 }
    out.standStill = { secs: 90, night: c.night(), onFloor: c.onFloor(), state: c.chivaState(),
                       combo: +c.combo().toFixed(3) }
    out.toastsA = toasts.slice()
    out.err = g.state.lastError || null
    return out
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p3c1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
