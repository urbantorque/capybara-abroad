async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('pantanal')
    await sleep(1500)
    const b = g.capy.body
    const c = g.pantanal.caiman()
    // WALK on from the side, which is what a player does
    const res = []
    for (let trial = 0; trial < 3; trial++) {
      const a = trial * 2.09
      b.position.set(c.x + Math.cos(a) * 3.0, c.y + 0.5, c.z + Math.sin(a) * 3.0)
      b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await sleep(900)
      // drive at it for 2.5 s by writing velocity directly (the animal's own
      // controller fights this, so we nudge rather than teleport)
      for (let i = 0; i < 55; i++) {
        const dx = c.x - b.position.x, dz = c.z - b.position.z
        const d = Math.hypot(dx, dz) || 1
        b.velocity.x = dx / d * 3.2
        b.velocity.z = dz / d * 3.2
        await sleep(45)
      }
      b.velocity.set(0,0,0)
      await sleep(900)
      res.push([+(b.position.y - c.y).toFixed(3),
                +Math.hypot(b.position.x - c.x, b.position.z - c.z).toFixed(2)])
    }
    // and did the task tick
    const card = [...document.querySelectorAll('#hud *')].map(e=>e.textContent||'')
    return { caimanY: +c.y.toFixed(3), walks: res,
             ticked: card.some(t => t.indexOf('jacar') >= 0 && t.indexOf('\u2713') >= 0) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5caim2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
