async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy, o = { marks: [], shots: [] }
    g.biome.switchTo('manly')
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false)
    const M = g.manly
    for (const k of Object.keys(M)) {
      const v = M[k]
      if (v && typeof v === 'object' && typeof v.x === 'number' && typeof v.z === 'number' && !Array.isArray(v)) {
        o.marks.push({ k, x: +v.x.toFixed(1), z: +v.z.toFixed(1) })
      }
    }
    const sp = g.biome.spawnOf('manly')
    o.spawn = [+sp.x.toFixed(1), +sp.z.toFixed(1)]
    // how much of the chapter is water? sample the walkable plan
    let wet = 0, dry = 0
    for (let x = -120; x <= 120; x += 6) {
      for (let z = -120; z <= 120; z += 6) {
        if (M.isOverWater && M.isOverWater(x, z)) wet++; else dry++
      }
    }
    o.wetCells = wet; o.dryCells = dry
    o.wetFrac = +(wet / (wet + dry)).toFixed(3)
    const shoot = async (n, cx, cy, cz, tx, ty, tz) => {
      g.renderer.setSize(1280, 720, false)
      g.camera.aspect = 1280 / 720; g.camera.updateProjectionMatrix()
      g.camera.position.set(cx, cy, cz); g.camera.lookAt(tx, ty, tz)
      g.camera.updateMatrixWorld(true)
      g.post.render()
      const u = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + n + '.png', { method: 'POST', body: u.split(',')[1] })
      o.shots.push(n)
    }
    const th = (x, z) => M.terrainHeight ? M.terrainHeight(x, z) : 0
    await shoot('B8-manly-spawn', sp.x, th(sp.x, sp.z) + 14, sp.z + 30, sp.x, th(sp.x, sp.z) + 2, sp.z - 30)
    await shoot('B8-manly-promenade', 0, th(0, 30) + 16, 70, 0, 2, -10)
    await shoot('B8-manly-wide', 0, 78, 150, 0, 0, -20)
    o.err = g.state.lastError || null
    return o
  })
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-manly.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
}
