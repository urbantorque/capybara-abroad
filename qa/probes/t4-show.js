async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    const shot = async (name, cx,cy,cz, tx,ty,tz) => {
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(cx,cy,cz); g.camera.lookAt(new THREE.Vector3(tx,ty,tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }
    const b = g.capy.body
    g.biome.switchTo('kowloon')
    b.position.set(-10.5, 35.4, 0); b.velocity.set(0,0,0)
    const hold = (n) => { for(let i=0;i<n;i++){ g.tick(1/60,false); b.position.set(-10.5,35.4,0); b.velocity.set(0,0,0) } }
    // run to the start of the show
    const samples = []
    hold(60*84)
    for (let k=0;k<10;k++) {
      hold(60*4)
      samples.push({ t:+(k*4+0).toFixed(0), lit: g.kowloon.litTowers ? g.kowloon.litTowers() : -1, show:+g.kowloon.show().toFixed(2) })
      if (k===1) await shot('T4-hk-show-1.png', -3, 43, 14, -13, 33, -60)
      if (k===4) await shot('T4-hk-show-2.png', -3, 43, 14, -13, 33, -60)
      if (k===7) await shot('T4-hk-show-3.png', -3, 43, 14, -13, 33, -60)
      if (k===9) await shot('T4-hk-show-4.png', -3, 43, 14, -13, 33, -60)
    }
    return samples
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4show.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
