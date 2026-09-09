async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  const out = { errs: [], rows: [] }

  // Walk every chapter in order and watch what the renderer is holding. A
  // chapter that is detached but never disposed shows up here and nowhere
  // else: it is invisible, it costs no draw calls, and it is still resident.
  // THE DIGIT PICKER ONLY WORKS FROM THE TITLE CARD. The first run of this
  // pressed Digit1 through Slash in one session and got nineteen readings of
  // Sydney — every probe in this repo does a fresh page.goto before its key,
  // which is why nobody had noticed. hud.cross() is the in-game route and it
  // is also the honest one: it goes through the same crossing a player takes.
  const B = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
             'venice','kowloon','palawan','goreme','manly','pantanal','cave',
             'antarctic','monaco','hanoi']
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)
  for (let i = 0; i < B.length; i++) {
    await page.evaluate((b) => { window.__capy.hud.cross(b) }, B[i])
    await page.waitForTimeout(5200)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const m = g.renderer.info.memory
      let objs = 0, meshes = 0
      g.scene.traverse((o) => { objs++; if (o.isMesh) meshes++ })
      const js = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null
      return { biome: g.biome.current, geo: m.geometries, tex: m.textures,
               objs: objs, meshes: meshes, bodies: g.world.bodies.length, heapMB: js }
    })
    out.rows.push(r)
  }
  // ...and back to chapter one, which is the only reading that answers the
  // question: does going away and coming back cost anything permanent?
  await page.evaluate(() => { window.__capy.hud.cross('sydney') })
  await page.waitForTimeout(6000)
  out.back = await page.evaluate(() => {
    const g = window.__capy
    const m = g.renderer.info.memory
    let objs = 0
    g.scene.traverse(() => { objs++ })
    return { biome: g.biome.current, geo: m.geometries, tex: m.textures, objs: objs,
             heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p8-mem.json', { method: 'POST', body: s })
  }, out)
}
