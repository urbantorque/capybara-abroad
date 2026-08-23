async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic'); g.state.lastError = null
    await new Promise(r => setTimeout(r, 1500))
    const b = g.capy.body, h = g.antarctic.boat.helm
    b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await new Promise(r => setTimeout(r, 900))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }))
    await new Promise(r => setTimeout(r, 90))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
  })
  // drive for 25 s in short slices so no single evaluate is over the limit
  for (let k = 0; k < 5; k++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))
  }
  await page.evaluate(async () => {
    const g = window.__capy
    for (let i = 0; i < 4; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
      await new Promise(r => setTimeout(r, 80))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
      await new Promise(r => setTimeout(r, 900))
    }
  })
  const probe = []
  for (let k = 0; k < 5; k++) {
    const r = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      let hi = -99
      const t = setInterval(() => {
        const bx = g.antarctic.boat.position.x, bz = g.antarctic.boat.position.z
        g.scene.traverse(o => {
          if (!o.isMesh) return
          if (Math.abs(o.position.x - bx) > 40 || Math.abs(o.position.z - bz) > 40) return
          if (o.position.y > hi) hi = o.position.y
        })
      }, 60)
      setTimeout(() => { clearInterval(t)
        res({ hi: +hi.toFixed(2), withPod: +g.antarctic.withPod().toFixed(2),
              sp: +g.antarctic.boat.speed.toFixed(1), z: +g.antarctic.boat.position.z.toFixed(0),
              err: g.state.lastError || null }) }, 4800)
    }))
    probe.push(r)
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })))
  const done = await page.evaluate(() => [...document.querySelectorAll('li.done')].map(e=>e.textContent.trim()).filter(t=>/orca|spy|lead/i.test(t)))
  await page.evaluate(async (o) => { await fetch('/shot?name=p5breach2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, { probe, done })
}
