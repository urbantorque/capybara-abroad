async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const seen = []
    const onImp = (p) => { if (p && p.prop) seen.push({ t: p.prop.type, v: p.voice, vp: p.vpitch, vg: p.vgain, s: +p.speed.toFixed(1) }) }
    g.events.on('prop:impact', onImp)
    const types = ['mug', 'winebottle', 'hat', 'bin', 'ball', 'deckchair', 'towel', 'sign', 'cone', 'ticket']
    const rows = {}
    const c = g.capy.position
    for (const t of types) {
      seen.length = 0
      let pr = null
      try { pr = g.physics.spawnProp(t, c.x + 4, c.z + 4) } catch (e) { rows[t] = { err: String(e) }; continue }
      if (!pr) { rows[t] = { err: 'no prop' }; continue }
      pr.body.wakeUp()
      pr.body.position.set(c.x + 4, c.y + 6, c.z + 4)
      pr.body.previousPosition.copy(pr.body.position)
      pr.body.interpolatedPosition.copy(pr.body.position)
      pr.body.velocity.set(0, -9, 0)
      const t0 = performance.now()
      let peak = 0
      while (performance.now() - t0 < 1400) {
        await new Promise(r => requestAnimationFrame(r))
        if (Math.abs(pr.sq || 0) > Math.abs(peak)) peak = pr.sq
      }
      rows[t] = { imp: seen[0] || null, peakSquash: +Number(peak).toFixed(3),
                  restScale: [+pr.mesh.scale.x.toFixed(3), +pr.mesh.scale.y.toFixed(3)] }
      try { g.physics.removeProp(pr) } catch (e) {}
    }
    g.events.off('prop:impact', onImp)
    return rows
  })
  const payload = JSON.stringify({ out, errs, err: await page.evaluate(() => window.__capy.state.lastError || null) })
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-mat.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
