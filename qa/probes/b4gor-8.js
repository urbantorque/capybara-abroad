async page => {
  const o = await page.evaluate(() => {
    const g = window.__capy, A = g.goreme
    const t = A.truck()
    // any physics body within 4 m of the truck?
    let near = 0
    const bodies = (g.world && g.world.bodies) || []
    for (const b of bodies) {
      if (Math.hypot(b.position.x - t.x, b.position.z - t.z) < 4) near++
    }
    // decor drift vs the wind at that altitude
    const T = g.THREE, m = new T.Matrix4(), v = new T.Vector3()
    let decor = null
    g.scene.traverse(n => { if (n.isInstancedMesh && n.count === 26 && !decor) decor = n })
    const samples = []
    if (decor) {
      for (let i = 0; i < 4; i++) {
        decor.getMatrixAt(i, m); v.setFromMatrixPosition(m)
        const gy = A.terrainHeight(v.x, v.z)
        const w = A.windAt(v.y - gy, v.x, v.z)
        samples.push({ alt: +(v.y-gy).toFixed(1), layer: A.layerOf(v.y-gy),
                       wind: +Math.hypot(w.x, w.z).toFixed(2) })
      }
    }
    return { truckBodiesNear: near, totalBodies: bodies.length, decorFound: !!decor, samples,
             layers: A.layers.map(l => [l.base, +Math.hypot(l.x,l.z).toFixed(2)]) }
  })
  await page.evaluate(async q => { await fetch('/shot?name=b4gor-8.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(q))))}) }, o)
}
