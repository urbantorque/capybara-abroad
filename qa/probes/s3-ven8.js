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
  await cam({ biome:'venice', warm:150, px:-4, py:1.6, pz:13, cx:-4, cy:7, cz:24, tx:-4, ty:3, tz:-6, name:'V8-arrival.png' })
  await cam({ biome:'venice', warm:60*125, px:-4, py:1.6, pz:-30, cx:-4, cy:6.5, cz:-16, tx:-4, ty:4, tz:-56, name:'V8-flood.png' })
  await cam({ biome:'venice', warm:60*3, px:-14, py:2.0, pz:-31, cx:-4, cy:4, cz:-31, tx:-30, ty:2.4, tz:-31, name:'V8-soto.png' })
  const st = await page.evaluate(() => { const g=window.__capy; return { tide: g.venice.waterLevel, err: g.state.lastError?String(g.state.lastError):'none' } })
  await page.evaluate(async (o) => { await fetch('/shot?name=v8info.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, st)
}
