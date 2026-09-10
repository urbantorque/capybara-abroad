async page => {
  // rd-look.js — an unforced look at nine chapters. No frameShot, no posing:
  // the resting lens, the gameplay camera, what a player actually sees.
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await shot('rd-00-title')
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(4000)
  await shot('rd-01-sydney-arrive')

  // walk a little so the gait, the camera and the crowd are all live
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2600)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(900)
  await shot('rd-02-sydney-walk')

  const started = await page.evaluate(() => window.__capy.state.started)

  const list = ['pasto', 'kyoto', 'rio', 'iceland', 'sahara', 'venice',
                'kowloon', 'palawan', 'cave', 'antarctic', 'monaco', 'hanoi']
  const rows = []
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(9000)
    // a short walk in each place, so nothing is a still life
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1800)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(1200)
    const info = await page.evaluate(() => {
      const g = window.__capy
      return { cur: g.biome.current, fps: g.hud.fpsNow ? g.hud.fpsNow() : null,
               err: g.state.lastError || null,
               tris: g.renderer.info.render.triangles,
               calls: g.renderer.info.render.calls }
    })
    rows.push(Object.assign({ want: b }, info))
    await shot('rd-' + String(10 + i) + '-' + b)
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-look.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { started, rows })
}
