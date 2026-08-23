async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = {}
  // ---------------- MANLY ----------------
  await page.evaluate(() => { const g=window.__capy; g.biome.switchTo('manly') })
  await page.waitForTimeout(1500)
  out.manly = await page.evaluate(() => {
    const g = window.__capy, m = g.manly
    const r = {}
    // A: bathers vs flags
    const fl = m.flags()
    r.flag = [ +fl.x.toFixed(1), +fl.z.toFixed(1) ]
    // find the bather instanced mesh by counting
    let bath = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 22 && !bath) bath = o })
    const M = new g.THREE.Matrix4(), P = new g.THREE.Vector3()
    let near = 0, zs = []
    if (bath) for (let i = 0; i < 22; i++) {
      bath.getMatrixAt(i, M); P.setFromMatrixPosition(M)
      const dx = P.x - fl.x, dz = P.z - fl.z
      if (dx*dx + dz*dz < 144) near++
      zs.push(+P.z.toFixed(1))
    }
    r.bathersWithin12 = near
    r.bathersNeeded = 20
    r.batherZ = zs
    // B: gulls — distinct positions
    let gull = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 30 && !gull) gull = o })
    const set = new Set()
    if (gull) for (let i = 0; i < 30; i++) {
      gull.getMatrixAt(i, M); P.setFromMatrixPosition(M)
      set.add(P.x.toFixed(1)+','+P.y.toFixed(1)+','+P.z.toFixed(1))
    }
    r.gullDistinct = set.size
    // C: surf club roof — step tops along the ramp
    const steps = []
    for (let i = 0; i < 7; i++) steps.push(+(2.6 + 0.35 + i*0.72 + 0.25).toFixed(2))
    r.rampTops = steps
    r.rampRise = 0.72
    // D: shark net buoys ride?
    const w = m.wave(-30, -62)
    r.buoyY = 0.25
    r.waveAtBuoy = +w.y.toFixed(2)
    // terrain at pines row / spawn
    r.pineXs = []
    for (let i = 0; i < 11; i++) r.pineXs.push(-56 + i*11.2)
    return r
  })
  // ---------------- PANTANAL ----------------
  await page.evaluate(() => { const g=window.__capy; g.biome.switchTo('pantanal') })
  await page.waitForTimeout(1500)
  out.pantanal = await page.evaluate(() => {
    const g = window.__capy, p = g.pantanal
    const r = {}
    const M = new g.THREE.Matrix4(), P = new g.THREE.Vector3()
    // grass
    let grass = null, best = 0
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count > best) { best = o.count; grass = o } })
    r.grassCount = best
    // spatial spread: how many in a 40x40 box round a few points
    const pts = [[50,34],[0,30],[-60,60],[36,96],[80,-20]]
    r.grassIn40 = []
    if (grass) {
      const xs = [], zs = []
      for (let i = 0; i < grass.count; i++) { grass.getMatrixAt(i, M); P.setFromMatrixPosition(M); xs.push(P.x); zs.push(P.z) }
      for (const q of pts) {
        let n = 0
        for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i]-q[0])<20 && Math.abs(zs[i]-q[1])<20) n++
        r.grassIn40.push([q[0], q[1], n])
      }
    }
    // cattle outside the corral
    let cattle = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 17) cattle = o })
    const CORX = 36-22, CORZ = 76, CORR = 13
    r.cows = []
    if (cattle) for (let i = 0; i < 11; i++) {
      cattle.getMatrixAt(i, M); P.setFromMatrixPosition(M)
      r.cows.push(+Math.hypot(P.x-CORX, P.z-CORZ).toFixed(1))
    }
    r.corralR = CORR
    // egret standing depth
    r.egret = []
    for (let i = 0; i < 13; i++) {
      const bx = -34 + (i%2?1:-1)*(3.4+(i%5)*2.3)
      const bz = -56 - 4 - i*1.45
      r.egret.push([+bx.toFixed(1), +bz.toFixed(1), +p.terrainHeight(bx,bz).toFixed(2)])
    }
    return r
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=f6probe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
