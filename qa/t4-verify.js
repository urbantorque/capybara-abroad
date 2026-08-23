async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const r = {}
    const b = g.capy.body
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))

    // --- DRIFT: the pennants, the skein scatter, the two locals ------------
    g.biome.switchTo('drift')
    b.position.set(11, 85.2, -110); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<180;i++) g.tick(1/60,false)
    // count pennant masts drawn: the arch mesh should carry three cylinders now
    let mastTris = 0
    g.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.boundingSphere &&
      Math.abs(o.geometry.boundingSphere.center.z + 116) < 40 && o.geometry.attributes.position.count > 1000) mastTris = o.geometry.index.count/3 })
    // skein: force one in and wheek at it
    r.driBodies = g.world.bodies.length
    // --- KOWLOON: show movements ------------------------------------------
    g.biome.switchTo('kowloon')
    b.position.set(-10.5, 35.4, 0); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<60*80;i++){ g.tick(1/60,false); b.position.set(-10.5,35.4,0); b.velocity.set(0,0,0) }
    const spread = []
    for (let k=0;k<6;k++) {
      for (let i=0;i<60*5;i++){ g.tick(1/60,false); b.position.set(-10.5,35.4,0); b.velocity.set(0,0,0) }
      const em = []
      g.scene.traverse(o => { if (o.userData && o.userData.hkTower !== undefined) em[o.userData.hkTower] = o.material.emissiveIntensity })
      const mn = Math.min.apply(null, em), mx = Math.max.apply(null, em)
      spread.push(+(mx-mn).toFixed(2))
    }
    r.hkShowSpread = spread
    // --- VENICE: seed throw + tide + mirror -------------------------------
    g.biome.switchTo('venice')
    b.position.set(-4, 1.6, -22); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let seedSeen = 0, mirrorOn = 0
    for (let i=0;i<60*140;i++){
      g.tick(1/60,false); b.position.set(-4,1.6,-22); b.velocity.set(0,0,0)
      let sm = null, mm = null
      if (i % 40 === 0) {
        g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 30) sm = o
                                 if (o.isInstancedMesh && o.count > 30 && o.count < 60 && o.renderOrder === 4) mm = o })
        if (sm && sm.visible) seedSeen++
        if (mm && mm.visible) mirrorOn++
      }
    }
    r.venSeedSamples = seedSeen
    r.venMirrorSamples = mirrorOn
    r.venTide = +g.venice.tide().toFixed(2)
    r.lastError = g.state && g.state.lastError || null
    r.bodies = { drift: r.driBodies, venice: g.world.bodies.length }
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4verify.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
