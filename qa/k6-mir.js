async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { const g=window.__capy; g.biome.switchTo('kyoto') })
  await page.waitForTimeout(1200)
  const out = await page.evaluate(() => {
    const g = window.__capy
    let mir = null, water = null
    g.scene.traverse(o => {
      if (o.isInstancedMesh && o.material && o.material.blending === 2 && o.renderOrder === 4) mir = o
      if (o.isMesh && o.geometry && o.geometry.attributes && o.name === 'kyoWater') water = o
    })
    const r = { found: !!mir }
    if (mir) {
      r.count = mir.count; r.visible = mir.visible; r.opacity = mir.material.opacity
      r.ro = mir.renderOrder; r.dw = mir.material.depthWrite; r.dt = mir.material.depthTest
      const m = new g.THREE.Matrix4(), p = new g.THREE.Vector3(), q = new g.THREE.Quaternion(), s = new g.THREE.Vector3()
      r.inst = []
      for (let i = 0; i < mir.count; i++) { mir.getMatrixAt(i, m); m.decompose(p,q,s)
        r.inst.push([Math.round(p.x*10)/10, Math.round(p.y*100)/100, Math.round(p.z*10)/10,
                     Math.round(s.x*100)/100, Math.round(s.z*100)/100]) }
    }
    r.wet = [[30,-22],[30,-2],[19,-12],[41,-12]].map(p => g.kyoto.isOverWater(p[0],p[1]))
    r.cam = [Math.round(g.camera.position.x), Math.round(g.camera.position.y), Math.round(g.camera.position.z)]
    return r
  })
  await page.evaluate((o) => fetch('/shot?name=k6mir.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
