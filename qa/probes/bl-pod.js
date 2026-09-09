async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    const r = { log: [] }
    g.biome.switchTo('antarctic')
    const cb = g.capy.body, b = g.antarctic.boat
    cb.position.set(b.helm.x, b.helm.y + 0.4, b.helm.z); cb.velocity.set(0,0,0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(700)
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    down('KeyE'); await sleep(90); up('KeyE'); await sleep(500)
    r.atHelm = g.antarctic.atHelm()
    down('KeyW'); await sleep(12000)
    r.pre = { boat: [Math.round(b.position.x), Math.round(b.position.z)], spd: +b.speed.toFixed(1),
              pod: [Math.round(g.antarctic.pod().x), Math.round(g.antarctic.pod().z)],
              pack: +g.antarctic.pack().toFixed(2) }
    // emit the event directly, bypassing the keyboard entirely
    let fired = 0
    g.events.on('capy:wheek', () => { fired++ })
    g.events.emit('capy:wheek', { position: g.capy.position })
    await sleep(300)
    r.fired = fired
    for (let i = 0; i < 26; i++) {
      await sleep(600)
      r.log.push([Math.round(g.antarctic.pod().x), Math.round(g.antarctic.pod().z),
                  +g.antarctic.withPod().toFixed(2), +b.speed.toFixed(1),
                  Math.round(b.position.z)])
    }
    up('KeyW')
    r.seenPod = g.antarctic.seenPod()
    r.err = g.state.lastError || null
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=blpod.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
