async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  // ---------- PANTANAL ----------
  out.pan = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('pantanal'); g.state.lastError = null
    await sleep(1200)
    const r = {}
    // stand next to a grazing capybara and wheek
    const h = g.pantanal.herd()
    const b = g.capy.body
    b.position.set(h.x + 2, g.pantanal.terrainHeight(h.x + 2, h.z + 2) + 0.8, h.z + 2)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(900)
    r.followBefore = g.pantanal.following()
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
      await sleep(80)
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
      await sleep(1300)
    }
    r.followAfter = g.pantanal.following()
    // stand on a caiman and see if the task fires
    const c = g.pantanal.caiman()
    b.position.set(c.x, c.y + 0.75, c.z)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(1800)
    r.caimanY = +b.position.y.toFixed(2)
    r.caimanTaskAt = c.y
    r.dusk = +g.pantanal.dusk().toFixed(3)
    r.err = g.state.lastError || null
    return r
  })
  // ---------- CAVE ----------
  out.cav = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('cave'); g.state.lastError = null
    await sleep(1500)
    const r = {}
    const b = g.capy.body
    b.position.set(-20, g.cave.terrainHeight(-20, 10) + 1.4, 10)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(900)
    let worms = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count > 300 && o.material && o.material.emissiveIntensity) worms = o })
    r.wormBefore = worms ? +worms.material.emissiveIntensity.toFixed(2) : null
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    await sleep(80)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
    await sleep(900)
    r.wormAfter = worms ? +worms.material.emissiveIntensity.toFixed(2) : null
    r.echo = +g.cave.echo().toFixed(2)
    r.err = g.state.lastError || null
    return r
  })
  // ---------- ANTARCTIC ----------
  out.ant = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('antarctic'); g.state.lastError = null
    await sleep(1500)
    const r = {}
    const b = g.capy.body
    b.position.set(24, g.antarctic.terrainHeight(24, 92) + 1.0, 92)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(1000)
    r.chorusBefore = !!(g.tasks && g.tasks.done && g.tasks.done('colony-chorus'))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    await sleep(80)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
    await sleep(2200)
    // read the checklist from the DOM instead, which is the only public place
    r.chorusRow = [...document.querySelectorAll('#hud *')].map(e=>e.textContent||'').filter(t=>t.indexOf('rookery')>=0).length
    // and inside the whale
    b.position.set(114, g.antarctic.terrainHeight(114, 14) + 0.6, 14)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(3500)
    r.inWhaleY = +b.position.y.toFixed(2)
    r.err = g.state.lastError || null
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5func.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }) }, out)
}
