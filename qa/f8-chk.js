async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { const g=window.__capy; g.biome.switchTo('manly') })
  await page.waitForTimeout(4000)
  const r = await page.evaluate(() => {
    const g = window.__capy
    let tris = 0
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      const gm = o.geometry
      const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
      tris += t * (o.isInstancedMesh ? (o.count||0) : 1)
    })
    // gull perch distinctness at rest
    let gull = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 30 && !gull) gull = o })
    const M = new g.THREE.Matrix4(), P = new g.THREE.Vector3(), set = new Set()
    if (gull) for (let i=0;i<30;i++){ gull.getMatrixAt(i,M); P.setFromMatrixPosition(M); set.add(P.x.toFixed(1)+','+P.z.toFixed(1)) }
    return { tris: Math.round(tris), bodies: g.world.bodies.length, gullDistinct: set.size,
             err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=f8chk.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, r)
}
