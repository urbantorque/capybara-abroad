async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  const out = {}
  for (const chap of ['kowloon', 'rio', 'venice']) {
    out[chap] = await page.evaluate(async (nm) => {
      const g = window.__capy
      if (g.biome.current !== nm) g.biome.switchTo(nm)
      await new Promise(r => setTimeout(r, 500))
      const mine = g.locals.filter(L => L.biome === nm)
      if (!mine.length) return { n: 0 }
      const L = mine[0]
      // stand the capybara well clear, so nothing is triggered by proximity
      const b = g.capy.body
      b.position.set(L.x + 30, (L.y || 0) + 1.4, L.z + 30)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      L.cd = 0; L.fl = 0; L.flV = 0; L.last = ''
      await new Promise(r => setTimeout(r, 400))
      const before = { fl: +L.fl.toFixed(3), rotX: +(L.group ? L.group.rotation.x : 0).toFixed(3), said: L.last }
      // a bang three metres from them
      g.events.emit('prop:impact', { prop: null, speed: 9,
        position: new g.THREE.Vector3(L.x + 2, (L.y || 0) + 0.5, L.z + 2) })
      let peakFl = 0, peakRot = 0
      const t0 = performance.now()
      while (performance.now() - t0 < 700) {
        await new Promise(r => requestAnimationFrame(r))
        if (L.fl < peakFl) peakFl = L.fl
        const rx = L.group ? L.group.rotation.x : 0
        if (rx < peakRot) peakRot = rx
      }
      const spoke = L.last
      // ...and it must go back to standing
      await new Promise(r => setTimeout(r, 1400))
      const rest = { fl: +L.fl.toFixed(3), rotX: +(L.group ? L.group.rotation.x : 0).toFixed(4) }
      // splash, at range
      L.cd = 0; L.last = ''
      g.events.emit('prop:water', { prop: null,
        position: new g.THREE.Vector3(L.x + 15, 0, L.z) })
      await new Promise(r => setTimeout(r, 300))
      const splashLine = L.last
      return { n: mine.length, before, peakFl: +peakFl.toFixed(3), peakLean: +peakRot.toFixed(3),
               spoke, rest, splashLine, hasFig: !!L.fig }
    }, chap)
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  out.errs = errs
  const payload = JSON.stringify(out)
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-locals.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
