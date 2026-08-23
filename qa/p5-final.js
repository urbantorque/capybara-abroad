async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const done = () => [...document.querySelectorAll('#hud li.done')].map(e => e.textContent.trim())
  const out = {}
  out.pan = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const D = () => [...document.querySelectorAll('li.done')].map(e => e.textContent.trim())
    g.biome.switchTo('pantanal'); g.state.lastError = null
    await sleep(1500)
    const b = g.capy.body
    const c0 = g.pantanal.caiman(); const c = { x: c0.x, y: c0.y, z: c0.z }
    b.position.set(c.x, c.y + 0.66, c.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(2600)
    const caiman = D().some(t => t.indexOf('jacar') >= 0)
    // and the bridge with the missing plank
    const br = g.pantanal.bridge
    b.position.set(br.x, 3.4, br.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(900)
    return { caiman: caiman, doneNow: D().length, err: g.state.lastError || null }
  })
  out.ant = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const D = () => [...document.querySelectorAll('li.done')].map(e => e.textContent.trim())
    g.biome.switchTo('antarctic'); g.state.lastError = null
    await sleep(1800)
    const b = g.capy.body
    b.position.set(24, g.antarctic.terrainHeight(24, 92) + 0.4, 92); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(1200)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    await sleep(80)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
    await sleep(1800)
    const chorus = D().some(t => t.indexOf('rookery') >= 0)
    // inside the whale, sitting still
    b.position.set(114, g.antarctic.terrainHeight(114, 14) + 0.4, 14); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(4200)
    const bones = D().some(t => t.indexOf('whale') >= 0)
    return { chorus, bones, err: g.state.lastError || null }
  })
  out.cav = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const D = () => [...document.querySelectorAll('li.done')].map(e => e.textContent.trim())
    g.biome.switchTo('cave'); g.state.lastError = null
    await sleep(1800)
    const b = g.capy.body
    // ride the log to the end of its run and check it does not teleport
    const l0 = g.cave.log(); const l = { x: l0.x, y: l0.y, z: l0.z }
    b.position.set(l.x, l.y + 1.2, l.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let minZ = 99, jumps = 0, lastZ = l.z
    for (let i = 0; i < 120; i++) {
      await sleep(120)
      const p = g.cave.log()
      if (Math.abs(p.z - lastZ) > 25) jumps++
      lastZ = p.z
      if (p.z < minZ) minZ = p.z
    }
    return { logMinZ: +minZ.toFixed(1), logJumps: jumps,
             onLog: +Math.hypot(b.position.x - lastZ * 0, 0).toFixed(1),
             err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5final.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }) }, out)
}
