async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('cave')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const root = g.scene.getObjectByName('cave')
    let cr = null
    root.traverse(o => { if (o.isInstancedMesh && o.count === 40) cr = o })
    const M = new g.THREE.Matrix4(), v = new g.THREE.Vector3()
    const cv = g.cave
    const snap = () => {
      let inWater = 0; const pos = []
      for (let i=0;i<40;i++){ cr.getMatrixAt(i,M); v.setFromMatrixPosition(M)
        if (cv.isOverWater(v.x,v.z)) inWater++
        pos.push([v.x,v.z]) }
      return {inWater, pos}
    }
    const a = snap()
    R.inWater0 = a.inWater
    // simulate 6 minutes with lots of wheeks (scatter)
    for (let k=0;k<12;k++){
      g.events.emit('capy:wheek', {})
      for (let i=0;i<1800;i++) g.tick(1/60,false)
    }
    const b = snap()
    R.inWaterAfter = b.inWater
    let maxDrift = 0, sum = 0
    for (let i=0;i<40;i++){
      const d = Math.hypot(b.pos[i][0]-a.pos[i][0], b.pos[i][1]-a.pos[i][1])
      if (d>maxDrift) maxDrift = d; sum += d
    }
    R.driftMax = +maxDrift.toFixed(1); R.driftMean = +(sum/40).toFixed(1)
    R.outOfCave = b.pos.filter(p => Math.abs(p[0])>60 || p[1]>44 || p[1]<-180).length
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=xprobe4.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))})
  }, out)
}
