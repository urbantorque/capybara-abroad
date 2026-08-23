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
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60,false); b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = o.fov||50; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(o.cx, o.cy, o.cz)
      g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + o.name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }, q)
  }
  await cam({ biome:'kowloon', warm:400, px:0, py:1.4, pz:6, cx:0, cy:6, cz:26, tx:0, ty:6, tz:-16, name:'H7-street.png' })
  await cam({ biome:'kowloon', warm:120, px:7.4, py:1.4, pz:10, cx:2, cy:3.4, cz:20, tx:9, ty:1.6, tz:2, name:'H7-crowd.png' })
  await cam({ biome:'kowloon', warm:120, px:0, py:1.4, pz:34, cx:0, cy:6, cz:48, tx:0, ty:5, tz:14, name:'H7-arrival.png' })
  const err = await page.evaluate(() => { const g=window.__capy; return { e: g.state.lastError?String(g.state.lastError):'none',
    tris: (()=>{let t=0;g.scene.traverse(o=>{if(!(o.isMesh||o.isInstancedMesh))return;for(let p=o;p;p=p.parent)if(!p.visible)return;const gm=o.geometry;if(!gm)return;const n=gm.index?gm.index.count/3:(gm.attributes.position?gm.attributes.position.count/3:0);t+=n*(o.isInstancedMesh?o.count:1)});return Math.round(t)})() } })
  await page.evaluate(async (o) => { await fetch('/shot?name=hk7.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, err)
}
