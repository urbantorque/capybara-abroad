async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      b.position.set(q.px, q.py, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||60);i++) { g.tick(1/60, false); b.position.set(q.px,q.py,q.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = q.fov || 46; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  const K='kowloon'
  // warm to the finale: SHOW_ON 0.545, SHOW_OFF 0.800, start 0.06, cycle 152 s
  // (0.545 + 0.86*(0.800-0.545) - 0.06) * 152 = 107 s = 6420 ticks
  await cam({ biome:K, warm:6500, px:-11,py:35,pz:0, cx:-4,cy:39,cz:22, tx:-13,ty:34,tz:-70, name:'X4-hk-show.png' })
  const st = await page.evaluate(() => ({ show: +window.__capy.kowloon.show().toFixed(2), lit: window.__capy.kowloon.litTowers(), err: window.__capy.state.lastError||null }))
  await page.evaluate(async (o) => { await fetch('/shot?name=wk.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, st)
  await cam({ biome:K, warm:20, px:0,py:1.4,pz:-40, cx:0,cy:4,cz:-26, tx:0,ty:16,tz:-80, name:'X4-hk-showstreet.png' })
  await cam({ biome:K, warm:20, px:-11,py:35,pz:0, cx:-2,cy:44,cz:30, tx:-16,ty:26,tz:-30, name:'X4-hk-roof.png' })
}
