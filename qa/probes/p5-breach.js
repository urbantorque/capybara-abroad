async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('antarctic'); g.state.lastError = null
    await sleep(1800)
    // take the tiller, drive out into the channel, call the pod, hold speed
    const b = g.capy.body
    const h = g.antarctic.boat.helm
    b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(900)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }))
    await sleep(90)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }))
    await sleep(600)
    const took = g.antarctic.atHelm()
    // full ahead, straight down the channel
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    const shots = []
    let sawBreach = 0, maxY = -99
    for (let i = 0; i < 340; i++) {
      await sleep(100)
      const bz = g.antarctic.boat.position.z
      if (bz < -60 && g.antarctic.withPod() === 0) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
        await sleep(60)
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
      }
      // watch every orca's y
      let hi = -99
      g.scene.traverse(o => { if (o.parent && o.parent.type === 'Group' && o.isMesh && o.position.y > hi && Math.abs(o.position.x - g.antarctic.boat.position.x) < 40) hi = o.position.y })
      if (hi > maxY) maxY = hi
      if (hi > 1.5) sawBreach++
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }))
    const D = () => [...document.querySelectorAll('li.done')].map(e => e.textContent.trim())
    return { took, maxOrcaY: +maxY.toFixed(2), breachFrames: sawBreach,
             withPod: +g.antarctic.withPod().toFixed(2), seenPod: g.antarctic.seenPod(),
             boatZ: +g.antarctic.boat.position.z.toFixed(0),
             done: D().filter(t => /orca|spy|lead|arch/i.test(t)),
             err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5breach.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
