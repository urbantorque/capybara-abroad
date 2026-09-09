async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(700)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__capy.biome.switchTo('iceland') })
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE, i = g.iceland
    const R = {}
    // ---- 1. every drawn thing in iceland, with a world position ------------
    const root = g.scene.getObjectByName && g.scene.getObjectByName('iceland')
    const items = []
    const box = new THREE.Box3(), v = new THREE.Vector3(), sz = new THREE.Vector3()
    g.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      if (o === g.capy.group) return
      try {
        box.setFromObject(o)
        box.getSize(sz); box.getCenter(v)
        const r = Math.max(sz.x, sz.z) * 0.5
        if (r > 90) return                     // ground mesh, sea plate, sky dome
        if (sz.y < 0.02 && r > 40) return
        items.push({ x: v.x, z: v.z, r, h: sz.y, inst: o.isInstancedMesh ? o.count : 1,
                     n: o.name || (o.geometry && o.geometry.type) || '?' })
      } catch (e) {}
    })
    R.items = items.length
    // ---- 2. the route -------------------------------------------------------
    const WP = [
      ['spawn', 0, 99], ['pylsa', 8, 99], ['organ', -16, 72],
      ['street', -6, 103], ['cliff', 70, 120], ['pier', 26, 137],
      ['strokkur', 10, -4], ['spring', -40, -10],
      ['snoutCat', 34, -86], ['cairn', 32, -174]
    ]
    R.wp = WP
    // the LEG that matters: spring -> cairn (the approach to the glacier)
    const legs = [
      ['town->strokkur', [0, 99], [10, -4]],
      ['strokkur->spring', [10, -4], [-40, -10]],
      ['spring->snout', [-40, -10], [34, -86]],
      ['snout->cairn', [34, -86], [32, -174]],
      ['town->cairn direct', [0, 99], [32, -174]]
    ]
    const cellAt = (x, z, rad) => {
      let n = 0
      for (const it of items) {
        const dx = it.x - x, dz = it.z - z
        if (dx * dx + dz * dz < (rad + it.r) * (rad + it.r)) n += Math.min(it.inst, 40)
      }
      return n
    }
    R.legs = legs.map(([name, a, b]) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(2, Math.round(L / 10))
      const cells = []
      for (let k = 0; k <= n; k++) {
        const t = k / n
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t
        cells.push({ x: +x.toFixed(0), z: +z.toFixed(0), n: cellAt(x, z, 14) })
      }
      const dead = cells.filter(c => c.n === 0).length
      return { name, len: +L.toFixed(1), cells: cells.length, dead,
               pct: +(dead / cells.length * 100).toFixed(0), c: cells.map(c => c.z + ':' + c.n) }
    })
    // ---- 3. what is drawn near the moraine corridor -------------------------
    R.moraine = items.filter(it => it.x > 10 && it.x < 60 && it.z < -60 && it.z > -200)
      .map(it => ({ n: it.n, x: +it.x.toFixed(0), z: +it.z.toFixed(0), r: +it.r.toFixed(1), h: +it.h.toFixed(1), inst: it.inst }))
      .sort((a, b) => b.z - a.z).slice(0, 60)
    // ---- 4. the walk-back corridor town->glacier ---------------------------
    R.valley = items.filter(it => it.z < 60 && it.z > -90 && Math.abs(it.x) < 70)
      .map(it => ({ n: it.n, x: +it.x.toFixed(0), z: +it.z.toFixed(0), r: +it.r.toFixed(1), inst: it.inst }))
      .sort((a, b) => b.z - a.z).slice(0, 70)
    // ---- 5. snowcat facts ---------------------------------------------------
    const sc = i.snowcat()
    R.snowcat = { x: +sc.x.toFixed(1), y: +sc.y.toFixed(1), z: +sc.z.toFixed(1) }
    R.glacierTop = i.glacierTop
    R.spring = i.spring
    R.terr = {
      snout: +i.terrainHeight(34, -86).toFixed(2),
      cairn: +i.terrainHeight(32, -174).toFixed(2),
      mid: +i.terrainHeight(34, -136).toFixed(2),
      valley0: +i.terrainHeight(0, 40).toFixed(2),
      valley1: +i.terrainHeight(10, -40).toFixed(2)
    }
    R.slipSamples = [[-16, -100], [-16, -140], [34, -140], [34, -100], [10, 0], [0, 60]]
      .map(p => p.join(',') + '=' + i.groundSlip(p[0], p[1]).toFixed(2))
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=p3iroute.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
