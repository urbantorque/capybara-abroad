async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    g.biome.switchTo('drift')
    const b = g.capy.body
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    // stand in the orchard and wheek until six are awake
    put(-38, 80.9, -114)
    for (let i=0;i<120;i++){ g.tick(1/60,false); put(-38,80.9,-114) }
    for (let k=0;k<10 && g.drift.lampflies() < 6; k++) {
      down('KeyQ'); g.tick(1/60,false); up('KeyQ')
      for (let i=0;i<40;i++){ g.tick(1/60,false); put(-38,80.9,-114) }
    }
    const awake = g.drift.lampflies()
    // then the Crown
    put(36, 108.9, -190)
    for (let i=0;i<60;i++){ g.tick(1/60,false); put(36,108.9,-190) }
    down('KeyE'); g.tick(1/60,false); up('KeyE')
    for (let i=0;i<60*7;i++){ g.tick(1/60,false); put(36,108.9,-190) }
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 4000
    g.camera.updateProjectionMatrix()
    g.camera.position.set(36, 116, -176)
    g.camera.lookAt(new THREE.Vector3(36, 112, -196))
    g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=D5-lit.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    g.camera.position.set(10, 122, -150)
    g.camera.lookAt(new THREE.Vector3(36, 108, -190))
    g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=D5-lit-wide.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    return { awake, lit: g.drift.lit(), glow: g.drift.glow(), e: g.state.lastError?String(g.state.lastError):'none' }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=dri5.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, out)
}
