async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('pasto')
    const b = g.capy.body
    b.position.set(9, 1.4, 35); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 60 * 11; i++) g.tick(1 / 60, false)
    let closest = null, cd = 99
    for (const bd of g.world.bodies) {
      if (bd === b) continue
      const d = Math.hypot(bd.position.x - b.position.x, bd.position.z - b.position.z)
      if (d < cd) { cd = d; closest = bd }
    }
    R.d = +cd.toFixed(2)
    R.type = closest.type; R.mass = closest.mass
    R.pos = [+closest.position.x.toFixed(2), +closest.position.y.toFixed(2), +closest.position.z.toFixed(2)]
    R.vel = [+closest.velocity.x.toFixed(2), +closest.velocity.y.toFixed(2), +closest.velocity.z.toFixed(2)]
    R.userDataFlat = closest.userData
      ? Object.keys(closest.userData).map(k => k + '=' + String(closest.userData[k]).slice(0, 40))
      : null
    R.shapes = closest.shapes.map(s => ({ type: s.type,
      he: s.halfExtents ? [s.halfExtents.x, s.halfExtents.y, s.halfExtents.z] : null,
      r: s.radius != null ? s.radius : null }))
    R.collisionFilterGroup = closest.collisionFilterGroup
    R.collisionFilterMask = closest.collisionFilterMask
    R.allowSleep = closest.allowSleep
    // count every kinematic body in the chapter and where they are
    const kin = []
    for (const bd of g.world.bodies) if (bd.type === 4)
      kin.push([+bd.position.x.toFixed(1), +bd.position.z.toFixed(1),
                +Math.hypot(bd.velocity.x, bd.velocity.z).toFixed(2),
                (bd.userData && Object.keys(bd.userData).join('|')) || ''])
    R.kinCount = kin.length; R.kin = kin.slice(0, 20)
    // is there an npc registry that names them?
    const nl = g.npc && g.npc.list ? g.npc.list() : null
    R.npcNear = nl ? nl.filter(n => Math.hypot(n.x - b.position.x, n.z - b.position.z) < 4)
                       .map(n => [n.id || n.kind || '?', +n.x.toFixed(1), +n.z.toFixed(1)]) : null
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-pasto4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
