async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const types = ['hat','coffee','sandwich','ball','bin','deckchair','flower','esky','thong','frisbee','basket','cone','handbag','icecream','sign','towel','chips','camera','sunglasses','ticket','menu','winebottle','empanada','arepa','maiz','plantain','ruana','coffeesack','cuencobowl','sombrero']
    const rows = []
    for (const t of types) {
      const p = g.physics.spawnProp(t, 400 + rows.length * 3, 400)
      if (!p) { rows.push({ t, err: 1 }); continue }
      const gm = p.mesh.geometry
      if (!gm.boundingBox) gm.computeBoundingBox()
      const bb = gm.boundingBox
      const sh = p.body.shapes[0]
      const half = sh.halfExtents ? [sh.halfExtents.x, sh.halfExtents.y, sh.halfExtents.z] : [sh.radius, sh.radius, sh.radius]
      rows.push({ t, mass: p.mass, sphere: !!sh.radius,
        drawn: [+(bb.max.x-bb.min.x).toFixed(3), +(bb.max.y-bb.min.y).toFixed(3), +(bb.max.z-bb.min.z).toFixed(3)],
        col: [+(half[0]*2).toFixed(3), +(half[1]*2).toFixed(3), +(half[2]*2).toFixed(3)],
        drawnVol: +((bb.max.x-bb.min.x)*(bb.max.y-bb.min.y)*(bb.max.z-bb.min.z)).toFixed(4),
        colVol: +(sh.radius ? 4.18879*Math.pow(sh.radius,3) : half[0]*half[1]*half[2]*8).toFixed(4),
        originY: p.originY, baseOff: +(bb.min.y + p.originY).toFixed(3) })
      g.physics.removeProp(p)
      p.mesh.parent && p.mesh.parent.remove(p.mesh)
      g.world.removeBody(p.body)
    }
    return rows
  })
  await page.evaluate((o) => fetch('/shot?name=fit2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
