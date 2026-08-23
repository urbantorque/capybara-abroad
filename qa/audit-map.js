async page => {
  await page.mouse.click(20, 20)
  await page.waitForTimeout(400)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1200)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      const a = g.hud.mapMarkAudit()
      return { ok: a.ok.length, missing: a.missing,
               shown: !!document.querySelector('.capyui-map.show'),
               dist: (document.querySelector('.capyui-mapdist') || {}).textContent || '' }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=auditmap.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
