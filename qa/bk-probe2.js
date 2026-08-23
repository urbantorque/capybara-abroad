async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  out.cave = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    const r = { ticks: [] }
    g.events.on('task:complete', e => { if (e && e.id) r.ticks.push(e.id) })
    g.biome.switchTo('cave')
    const cb = g.capy.body
    cb.position.set(0, 4, 60); cb.velocity.set(0,0,0)
    await sleep(30000)
    r.after45 = r.ticks.slice()
    cb.position.set(-30, 9.6, -126); cb.velocity.set(0,0,0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(900)
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}))
    await sleep(90)
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyQ',bubbles:true}))
    await sleep(2500)
    r.afterWheek = r.ticks.slice()
    return r
  })
  out.ant = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    const r = { ticks: [], podTrack: [] }
    g.events.on('task:complete', e => { if (e && e.id) r.ticks.push(e.id) })
    g.biome.switchTo('antarctic')
    const cb = g.capy.body
    const b = g.antarctic.boat
    cb.position.set(b.helm.x, b.helm.y + 0.4, b.helm.z); cb.velocity.set(0,0,0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(700)
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    down('KeyE'); await sleep(90); up('KeyE'); await sleep(500)
    down('KeyW')
    await sleep(14000)
    const p0 = g.antarctic.pod()
    r.podAtCall = [Math.round(p0.x), Math.round(p0.z)]
    r.boatAtCall = [Math.round(b.position.x), Math.round(b.position.z)]
    r.spdAtCall = +b.speed.toFixed(1)
    down('Space'); await sleep(100); up('Space')
    for (let i = 0; i < 30; i++) {
      await sleep(700)
      const p = g.antarctic.pod()
      r.podTrack.push([Math.round(p.x), Math.round(p.z), +g.antarctic.withPod().toFixed(2), +b.speed.toFixed(1)])
    }
    up('KeyW')
    r.seenPod = g.antarctic.seenPod()
    r.lastError = g.state.lastError || null
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=bkprobe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
