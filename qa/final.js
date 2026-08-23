async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.reload(); await page.waitForTimeout(4500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.state.lastError = null
    }, n)
    await page.waitForTimeout(1400)
    await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w')
    await page.keyboard.press('q')
    await page.waitForTimeout(900)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const a = g.hud.mapMarkAudit()
      return { err: g.state.lastError || null, saves: g.state.solverSaves || 0,
        marks: a.ok.length, missing: a.missing.length,
        map: !!document.querySelector('.capyui-map.show'),
        locals: (g.locals || []).filter(l => l.biome === name).length,
        figures: (g.locals || []).filter(l => l.biome === name && l.fig).length }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=final.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
