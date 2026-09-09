async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('drift')
    const sp = g.biome.spawnOf('drift'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current
    R.live = live; R.spawn = { x: +sp.x.toFixed(1), y: +sp.y.toFixed(1), z: +sp.z.toFixed(1) }
    // ---- locals ----
    const L = g.locals.filter(r => r.biome === live)
    R.locals = L.map(r => ({ x: +r.x.toFixed(1), z: +r.z.toFixed(1), y: +(r.y||0).toFixed(1),
      fig: !!r.fig, near: r.near, ax: +(r.ax!==undefined?r.ax:r.x).toFixed(1), az: +(r.az!==undefined?r.az:r.z).toFixed(1) }))
    // ---- props ----
    const props = g.props.filter(p => !p.removed && (!p.biome || p.biome === live))
    R.props = props.map(p => ({ t: p.type, m: p.mass,
      hx: +(p.homeX||0).toFixed(1), hz: +(p.homeZ||0).toFixed(1),
      y: +p.body.position.y.toFixed(1),
      own: !!p.owner,
      nearest: (function () {
        let bd = 1e9, id = ''
        for (const r of L) { if (!r.fig) continue
          const dx = (p.homeX||0) - (r.ax!==undefined?r.ax:r.x), dz = (p.homeZ||0) - (r.az!==undefined?r.az:r.z)
          const d = Math.hypot(dx, dz); if (d < bd) { bd = d; id = (r.ax!==undefined?r.ax:r.x).toFixed(0)+','+(r.az!==undefined?r.az:r.z).toFixed(0) } }
        return { d: +bd.toFixed(1), at: id } })() }))
    // ---- wind over one full breath ----
    const w = []
    for (let k = 0; k < 44; k++) {
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const dw = g.drift.wind()
      w.push(+Math.hypot(dw.x, dw.z).toFixed(2))
    }
    R.windSeries = w
    R.windMax = Math.max.apply(null, w); R.windMin = Math.min.apply(null, w)
    R.windOver2 = w.filter(v => v > 2.0).length / w.length
    // ---- the surface ladder against the real islands ----
    R.islandKinds = {}
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
  await page.evaluate(async e => {
    await fetch('/shot?name=b3dri1e.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(e)))) })
  }, errs)
}
