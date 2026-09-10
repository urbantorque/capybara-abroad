async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave',
                 'antarctic','monaco','hanoi']
  const out = { rows: [], errs: [] }
  for (const n of NAMES) {
    const r = await page.evaluate(async nm => {
      const g = window.__capy
      g.state.lastError = null
      g.biome.switchTo(nm)
      const sp = g.biome.spawnOf(nm)
      g.capy.body.position.set(sp.x, sp.y, sp.z)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 2600))
      const p = g.capy.body.position
      return { n: nm, biome: g.biome.current,
               bodies: g.world.bodies.length,
               objs: g.scene.children.length,
               pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
               nan: !(isFinite(p.x) && isFinite(p.y) && isFinite(p.z)),
               err: g.state.lastError || null }
    }, n)
    out.rows.push(r)
    if (r.err) out.errs.push(n + ': ' + r.err)
  }
  // re-entry leak check: three round trips through rio and goreme
  const leak = await page.evaluate(async () => {
    const g = window.__capy, seq = []
    for (let i = 0; i < 3; i++) {
      for (const nm of ['rio','goreme','sydney']) {
        g.biome.switchTo(nm)
        const sp = g.biome.spawnOf(nm)
        g.capy.body.position.set(sp.x, sp.y, sp.z)
        await new Promise(r => setTimeout(r, 900))
      }
      seq.push({ pass: i, bodies: g.world.bodies.length, objs: g.scene.children.length })
    }
    return seq
  })
  out.leak = leak
  const con = await page.evaluate(() => window.__capy.state.lastError || null)
  out.finalErr = con
  await page.evaluate(o => fetch('/shot?name=T4-base.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
