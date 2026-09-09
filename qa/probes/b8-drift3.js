async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('pasto')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    const sp = g.biome.spawnOf('pasto')
    b.position.set(sp.x + 9, sp.y, sp.z + 9)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)

    const realStep = g.world.step
    let pre = null, post = null
    g.world.step = function () {
      pre = [b.velocity.x, b.velocity.y, b.velocity.z, b.position.z]
      const r = realStep.apply(this, arguments)
      post = [b.velocity.x, b.velocity.y, b.velocity.z, b.position.z]
      return r
    }
    const describe = (bd) => {
      const u = bd.userData || {}
      return {
        type: bd.type, mass: bd.mass,
        tag: Object.keys(u).slice(0, 4).join(','),
        name: u.name || u.npc || u.kind || u.tag || null,
        shapes: bd.shapes.map(s => s.type).join('/'),
        p: [+bd.position.x.toFixed(2), +bd.position.y.toFixed(2), +bd.position.z.toFixed(2)]
      }
    }
    const rows = []
    let pz = b.position.z
    for (let i = 0; i < 60 * 25; i++) {
      g.tick(1 / 60, false)
      const dz = b.position.z - pz
      if (Math.abs(dz) > 0.02 && rows.length < 6) {
        const cs = []
        for (const c of g.world.contacts) {
          if (c.bi === b) cs.push(describe(c.bj))
          else if (c.bj === b) cs.push(describe(c.bi))
        }
        rows.push({
          t: +(i / 60).toFixed(2), dz: +dz.toFixed(4),
          preV: pre.map(n => +n.toFixed(3)), postV: post.map(n => +n.toFixed(3)),
          vlambda: [+b.vlambda.x.toFixed(3), +b.vlambda.z.toFixed(3)],
          nContacts: cs.length, contacts: cs.slice(0, 5)
        })
      }
      pz = b.position.z
    }
    R.moved = +Math.hypot(b.position.x - (sp.x + 9), b.position.z - (sp.z + 9)).toFixed(3)
    R.rows = rows
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
