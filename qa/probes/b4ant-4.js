async page => {
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(2000)

  const out = await page.evaluate(() => {
    const g = window.__capy
    const root = g.scene.getObjectByName('antarctic')
    const tri = o => {
      const geo = o.geometry
      if (!geo) return 0
      const n = geo.index ? geo.index.count / 3 : (geo.attributes.position ? geo.attributes.position.count / 3 : 0)
      return Math.round(n * (o.isInstancedMesh ? o.count : 1))
    }
    const rows = []
    root.traverse(o => {
      if (!o.isMesh) return
      rows.push({ t: tri(o), cs: !!o.castShadow, rs: !!o.receiveShadow,
                  g: o.geometry.type, inst: o.isInstancedMesh ? o.count : 0,
                  vis: o.visible, y: +o.position.y.toFixed(1) })
    })
    rows.sort((a, b) => b.t - a.t)
    const total = rows.reduce((s, r) => s + r.t, 0)
    const shadow = rows.filter(r => r.cs).reduce((s, r) => s + r.t, 0)

    // how much of the 424 x 624 ground sheet is under an opaque sea
    const a = g.antarctic, W = a.waterLevel
    let cells = 0, land = 0
    for (let x = -212; x <= 212; x += 4) {
      for (let z = -500; z <= 122; z += 4) {
        cells++
        if (a.terrainHeight(x, z) > W - 0.2) land++
      }
    }

    // the six locals and the marquee point
    const marquee = [20.2, -213.3]
    return {
      total, shadow, top: rows.slice(0, 12),
      shadowTop: rows.filter(r => r.cs).slice(0, 8),
      groundCells: cells, landCells: land, landPct: +(land / cells * 100).toFixed(1),
      marquee,
    }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4ant-4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
