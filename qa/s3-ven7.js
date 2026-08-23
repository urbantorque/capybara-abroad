async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const cam = async (q) => {
    await page.evaluate(async (o) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== o.biome) g.biome.switchTo(o.biome)
      const b = g.capy.body
      b.position.set(o.px, o.py, o.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60,false); b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = o.fov||50; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(o.cx, o.cy, o.cz)
      g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + o.name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }, q)
  }
  await cam({ biome:'venice', warm:200, px:-4, py:1.6, pz:-40, cx:-4, cy:7, cz:-30, tx:-4, ty:8, tz:-62, name:'V7-basilica.png' })
  await cam({ biome:'venice', px:-4, py:1.6, pz:-30, cx:-4, cy:2.2, cz:-25, tx:-4, ty:1.1, tz:-34, name:'V7-pigeon.png', fov:38 })
  await cam({ biome:'venice', px:-17.8, py:1.0, pz:-14, cx:-12, cy:3.6, cz:-7, tx:-19, ty:1.6, tz:-20, name:'V7-cafe.png' })
  await cam({ biome:'venice', warm:150, px:-4, py:1.6, pz:13, cx:-4, cy:7, cz:24, tx:-4, ty:3, tz:-6, name:'V7-arrival.png' })
  const st = await page.evaluate(() => {
    const g = window.__capy
    const pts = [[-17.8,-10.4],[-8.5,10],[-8,-19],[-50,-35],[-95,-17],[-17.8,-20],[-54,-24]]
    const CANNON = g.CANNON
    const boxes = []
    for (const b of g.world.bodies) {
      if (b.mass > 0 && b.type !== 4) continue
      let skip = false
      for (const sh of b.shapes) { const t = sh.constructor && sh.constructor.name; if (t==='Heightfield'||t==='Plane') skip=true }
      if (skip) continue
      b.updateAABB()
      boxes.push([b.aabb.lowerBound.x,b.aabb.lowerBound.y,b.aabb.lowerBound.z,b.aabb.upperBound.x,b.aabb.upperBound.y,b.aabb.upperBound.z])
    }
    return { rows: pts.map(p => {
      const y = g.venice.terrainHeight(p[0],p[1])
      let inside = false
      for (const q of boxes) if (p[0]>q[0]&&p[0]<q[3]&&y+1>q[1]&&y+1<q[4]&&p[1]>q[2]&&p[1]<q[5]) inside = true
      return [p[0],p[1],+y.toFixed(2), inside, g.venice.isOverWater(p[0],p[1])]
    }), err: g.state.lastError ? String(g.state.lastError) : 'none',
        tris: (()=>{let t=0;g.scene.traverse(o=>{if(!(o.isMesh||o.isInstancedMesh))return;for(let p=o;p;p=p.parent)if(!p.visible)return;const gm=o.geometry;if(!gm)return;const n=gm.index?gm.index.count/3:(gm.attributes.position?gm.attributes.position.count/3:0);t+=n*(o.isInstancedMesh?o.count:1)});return Math.round(t)})(),
        bodies: g.world.bodies.length }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=v7info.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, st)
}
