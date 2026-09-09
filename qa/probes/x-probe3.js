async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('antarctic')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const root = g.scene.getObjectByName('antarctic')
    // find the petrel instanced mesh: count 26
    let petrel = null, pack = null
    root.traverse(o => {
      if (o.isInstancedMesh && o.count === 26 && !petrel) petrel = o
      if (o.isInstancedMesh && o.count === 1400) pack = o
    })
    const M = new g.THREE.Matrix4(), v = new g.THREE.Vector3()
    const an = g.antarctic
    R.petrelBelow = 0; R.petrelSamples = []
    if (petrel) for (let i=0;i<26;i++){
      petrel.getMatrixAt(i, M); v.setFromMatrixPosition(M)
      const th = an.terrainHeight(v.x, v.z)
      if (v.y < th) R.petrelBelow++
      if (i<8) R.petrelSamples.push([Math.round(v.x),Math.round(v.y),Math.round(v.z),+th.toFixed(1)])
    }
    // pack lumps: how many within 100 m of a mid-channel point
    R.packNear = 0; R.packAlive = 0
    if (pack) for (let i=0;i<460;i++){
      pack.getMatrixAt(i,M); v.setFromMatrixPosition(M)
      if (v.y < -800) continue
      R.packAlive++
      if (Math.abs(v.x-0)<100 && Math.abs(v.z+200)<100) R.packNear++
    }
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=xprobe3.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))})
  }, out)
}
