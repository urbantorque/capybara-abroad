async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('drift')
    const b = g.capy.body
    const api = g.drift
    const rows = []
    // drop the animal on the middle of every island and see where it settles
    const ISL = [['shelf',0,30],['stepA',-4,-2],['stepB',-25,-15],['stepC',-3,-35],
                 ['anvil',-38,-47],['shoalA',-56,-80],['orchard',-38,-114],['arch',3,-103],
                 ['farside',42,-137],['crown',36,-184],['pebA',24,-6],['pebD',-72,-150]]
    for (const [id, x, z] of ISL) {
      const want = api.terrainHeight(x, z)
      b.position.set(x, want + 3, z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 150; i++) g.tick(1/60, false)
      rows.push({ id, want: +want.toFixed(2), got: +b.position.y.toFixed(2),
                  dy: +(b.position.y - want).toFixed(2), grounded: !!g.capy.grounded,
                  water: api.isOverWater(x, z) })
    }
    // and the wanderers, which move
    const w = api.wanderer()
    const wy = api.terrainHeight(w.x, w.z)
    b.position.set(w.x, wy + 2, w.z); b.velocity.set(0,0,0)
    for (let i = 0; i < 240; i++) g.tick(1/60, false)
    const wr = { x: +b.position.x.toFixed(1), y: +b.position.y.toFixed(2), z: +b.position.z.toFixed(1),
                 grounded: !!g.capy.grounded, rode: api.inZone('wander', b.position.x, b.position.z) };
    // the lantern's wave: light it and watch the beacons come up
    b.position.set(36, 110, -190); b.velocity.set(0,0,0)
    for (let i = 0; i < 90; i++) g.tick(1/60, false)
    let beacon = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.instanceColor && o.material &&
      o.material.blending === undefined) {} })
    return { rows, wander: wr, err: g.state.lastError || null,
             gravity: g.world.gravity.y }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=z9probe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
