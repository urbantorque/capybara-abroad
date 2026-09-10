async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__capy.renderer.setSize(1280, 760, false) })
  const info = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const sp = g.biome.spawnOf('cave')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2800))
    const C = g.cave
    const d = C.columnDebug()
    // arm a real fall from the cap, then hold the animal in CLEAR AIR eight
    // metres out from the trunk so the chase camera is not inside the rock
    g.capy.body.position.set(4, d.top + 0.6, -48)
    await new Promise(r => setTimeout(r, 1200))
    g.capy.body.position.set(4 + 6.0, d.top + 0.6, -48)
    g.capy.body.velocity.set(2.2, 0, 0)
    const t0 = Date.now()
    while (Date.now() - t0 < 3500) {
      await new Promise(r => setTimeout(r, 45))
      if (C.columnDebug().fall > 0.9) break
    }
    g.input.camYaw = 0
    for (let k = 0; k < 30; k++) {
      g.capy.body.position.set(4 + 8.5, d.base + 15, -48 + 1.0)
      g.capy.body.velocity.set(0, -9, 0)
      await new Promise(r => setTimeout(r, 40))
    }
    return C.columnDebug()
  })
  await page.screenshot({ path: 'qa/T4-col-fall2.png' })
  await page.evaluate(o => fetch('/shot?name=T4-fallshot.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { info })
}
