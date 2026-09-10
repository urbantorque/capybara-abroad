async page => {
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave',
                 'antarctic','monaco','hanoi']
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), rows: [], errs: [] }
  for (const n of NAMES) {
    const r = await page.evaluate(async nm => {
      const g = window.__capy
      g.state.lastError = null
      g.biome.switchTo(nm)
      const sp = g.biome.spawnOf(nm)
      g.capy.body.position.set(sp.x, sp.y, sp.z)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 2400))
      const p = g.capy.body.position
      return { n: nm, biome: g.biome.current, bodies: g.world.bodies.length,
               nan: !(isFinite(p.x) && isFinite(p.y) && isFinite(p.z)),
               err: g.state.lastError || null }
    }, n)
    out.rows.push(r)
    if (r.err) out.errs.push(n + ': ' + r.err)
  }
  // and the three new hunts are reachable in the bundle
  out.hooks = await page.evaluate(() => ({
    skua: typeof (window.__capy.antarctic || {}).skuaDebug,
    tern: typeof (window.__capy.palawan || {}).ternDebug,
    jag: typeof (window.__capy.pantanal || {}).jaguarDebug,
    surf: typeof (window.__capy.manly || {}).surfDebug,
  }))
  await page.evaluate(o => fetch('/shot?name=T4-dist.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
