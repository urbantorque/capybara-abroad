async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  out.cave = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('cave')
    const cb = g.capy.body
    const r = {}
    // 1. does 'swiftlets' tick on its own from the entrance? soak 70 s at spawn
    cb.position.set(0, 4, 60); cb.velocity.set(0,0,0)
    let ticked = null
    const onT = e => { if (e && e.id === 'swiftlets') ticked = 'auto' }
    g.events.on('task:complete', onT)
    await sleep(70000)
    r.swiftAuto = ticked
    // 2. now wheek AT the roost
    cb.position.set(-30, 9.5, -126); cb.velocity.set(0,0,0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(700)
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}))
    await sleep(90)
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}))
    await sleep(2500)
    r.swiftMine = ticked
    g.events.off('task:complete', onT)
    // 3. daylight at the slot and at the doline
    r.dayExit = +g.cave.daylight().toFixed(2)
    cb.position.set(4, -1.5, -48); cb.velocity.set(0,0,0)
    await sleep(1200)
    r.dayDoline = +g.cave.daylight().toFixed(2)
    return r
  })
  out.ant = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const cb = g.capy.body
    const r = { ticks: [] }
    const onT = e => { if (e && e.id) r.ticks.push(e.id) }
    g.events.on('task:complete', onT)
    const b = g.antarctic.boat
    cb.position.set(b.helm.x, b.helm.y + 0.4, b.helm.z); cb.velocity.set(0,0,0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(600)
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    down('KeyE'); await sleep(80); up('KeyE'); await sleep(400)
    r.atHelm = g.antarctic.atHelm()
    down('KeyW')
    await sleep(9000)
    r.speed1 = +g.antarctic.boat.speed.toFixed(1)
    down('Space'); await sleep(90); up('Space')
    let withPod = 0
    for (let i = 0; i < 40; i++) { await sleep(500); withPod = Math.max(withPod, g.antarctic.withPod()) }
    up('KeyW')
    r.withPod = +withPod.toFixed(2)
    r.seenPod = g.antarctic.seenPod()
    r.speed2 = +g.antarctic.boat.speed.toFixed(1)
    r.z = +g.antarctic.boat.position.z.toFixed(0)
    g.events.off('task:complete', onT)
    r.lastError = g.state.lastError || null
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=bjbehav.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }) }, out)
}
