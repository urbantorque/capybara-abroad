async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0,180)))
  const out = { errs }
  out.cast = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 90; i++) g.tick(1/60, false)
    const live = g.biome.current
    const L = g.locals.filter(r => r.biome === live)
    const walkers = L.filter(r => r.fig)
    const OWN_R = 11, CHAIN_R = 20
    const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
      (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 12)
    const owners = new Set(); const pairs = []
    for (const p of props) {
      let best = null, bd = OWN_R*OWN_R
      for (const r of walkers) { const dx=p.homeX-r.ax, dz=p.homeZ-r.az, d2=dx*dx+dz*dz; if (d2<bd){bd=d2;best=r} }
      if (best) { pairs.push([p.type, +Math.sqrt(bd).toFixed(1)]); owners.add(best) }
    }
    let chains = 0
    for (let i=0;i<L.length;i++) for (let j=i+1;j<L.length;j++) {
      if (Math.hypot(L[i].x-L[j].x, L[i].z-L[j].z) < CHAIN_R) chains++
    }
    return { locals: L.length, walkers: walkers.length, props: props.length,
             owned: pairs.length, owners: owners.size, ownList: pairs.slice(0,8), chains,
             locPos: L.map(r => [Math.round(r.x), Math.round(r.z), !!r.fig]) }
  })
  // stillness + loaf at two points
  out.still = []
  for (const P of [[0,34],[0,4],[20,-60]]) {
    const r = await page.evaluate(async (p) => {
      const g = window.__capy, A = g.goreme
      const b = g.capy.body
      const y = A.terrainHeight(p[0], p[1]) + 1.2
      b.position.set(p[0], y, p[1]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1/60, false)
      const x0 = b.position.x, y0 = b.position.y, z0 = b.position.z
      for (let i = 0; i < 3600; i++) g.tick(1/60, false)
      return { at: p, disp: +Math.hypot(b.position.x-x0, b.position.z-z0).toFixed(3),
               dy: +(b.position.y-y0).toFixed(3), loaf: g.capy.loaf,
               pitch: A.surfacePitch(b.position.x, b.position.z, b.position.y) }
    }, P)
    out.still.push(r)
  }
  await page.evaluate(async q => { await fetch('/shot?name=b4gor-7.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(q))))}) }, out)
}
