async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('venice')
    for (let i=0;i<60;i++) g.tick(1/60,false)
    let pools = null, lamps = null
    g.scene.traverse(o => {
      if (o.isMesh && o.material && o.material.blending === 2 && o.renderOrder === 2) pools = { v:o.visible, op:o.material.opacity, tris:o.geometry.index.count/3, bs:o.geometry.boundingSphere && [Math.round(o.geometry.boundingSphere.center.x),Math.round(o.geometry.boundingSphere.center.y),Math.round(o.geometry.boundingSphere.center.z),Math.round(o.geometry.boundingSphere.radius)] }
    })
    // what is the big grey thing at (-19, 1.4, -34)?
    const THREE = g.THREE
    const ray = new THREE.Raycaster()
    ray.set(new THREE.Vector3(-19, 6, -34), new THREE.Vector3(0,-1,0))
    const meshes = []
    g.scene.traverse(m => { if (m.isMesh||m.isInstancedMesh) meshes.push(m) })
    const hs = ray.intersectObjects(meshes, false).slice(0,4).map(h => ({
      y:+h.point.y.toFixed(2), col:'#'+(Array.isArray(h.object.material)?h.object.material[0]:h.object.material).color.getHexString(),
      inst: !!h.object.isInstancedMesh, ro: h.object.renderOrder }))
    return { pools, hits: hs, terr: +g.venice.terrainHeight(-19,-34).toFixed(2) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4log.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
