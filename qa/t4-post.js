async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    const grab = async (name) => {
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }
    const b = g.capy.body
    const walk = (bio, x,y,z, secs, keys) => {
      g.biome.switchTo(bio)
      b.position.set(x,y,z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      const n = 60*secs
      for (let i=0;i<n;i++) {
        if (keys && i === 4) for (const k of keys) down(k)
        if (keys && i === n-40) for (const k of keys) up(k)
        g.tick(1/60, i > n-3)
      }
    }
    walk('kowloon', 0, 1.4, 40, 8, ['KeyW'])
    await grab('T4P-hk-street.png')
    walk('kowloon', -10.5, 35.4, 0, 6, null)
    await grab('T4P-hk-roof.png')
    walk('venice', -4, 1.6, -24, 120, null)
    await grab('T4P-ven-flood.png')
    walk('drift', 2, 31.6, 42, 6, ['KeyW'])
    await grab('T4P-dri-spawn.png')
  })
}
