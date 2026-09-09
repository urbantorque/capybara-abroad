async page => {
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('pantanal'); await sleep(800)
    const b = g.capy.body, m = g.pantanal
    const h = m.terrainHeight(-20, -40)
    b.position.set(-20, h + 0.6, -40); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1/60, false)
    const root = g.scene.getObjectByName('pantanal')
    const rows = []
    root.traverse(n => {
      if (!n.isMesh || !n.geometry) return
      const gm = n.geometry
      const tri = (gm.index ? gm.index.count : gm.attributes.position.count) / 3
      const cnt = n.isInstancedMesh ? n.count : 1
      if (tri * cnt < 4000) return
      if (!gm.boundingBox) gm.computeBoundingBox()
      const bb = gm.boundingBox
      rows.push({ tri: tri * cnt, inst: cnt, type: gm.type, cast: n.castShadow, recv: n.receiveShadow,
                  transp: !!(n.material && n.material.transparent), op: n.material && n.material.opacity,
                  vc: !!(n.material && n.material.vertexColors), side: n.material && n.material.side,
                  ro: n.renderOrder,
                  bb: [+bb.min.x.toFixed(1), +bb.max.x.toFixed(1), +bb.min.y.toFixed(1), +bb.max.y.toFixed(1), +bb.min.z.toFixed(1), +bb.max.z.toFixed(1)] })
    })
    rows.sort((a,b2) => b2.tri - a.tri)
    window.__PAN = { root: root }
    return { rows: rows }
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4pan-6.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
