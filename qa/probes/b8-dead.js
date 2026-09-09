async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy, o = { shots: [] }
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
    const at = (api, x, z) => api.terrainHeight ? api.terrainHeight(x, z) : 0

    g.biome.switchTo('kyoto')
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false)
    const K = g.kyoto
    // the Uji leg, looking back up the run, and the mill leg
    await shoot('B8-dead-kyoto-uji', 10, at(K, 10, 179) + 6, 179 + 16, 10, at(K, 10, 179) + 1, 179 - 20)
    await shoot('B8-dead-kyoto-mill', 38, at(K, 38, 90) + 7, 90 + 18, 48, at(K, 48, 96) + 1, 96)
    await shoot('B8-dead-kyoto-bridge', -9, at(K, -9, 77) + 7, 77 + 18, -9, at(K, -9, 77) + 1, 77 - 15)

    g.biome.switchTo('monaco')
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false)
    const M = g.monaco
    await shoot('B8-dead-monaco-tunnel', 111, at(M, 111, -31) + 8, -31 + 20, 111, at(M, 111, -31) + 1, -31 - 18)
    await shoot('B8-dead-monaco-hairpin', 136, at(M, 136, 10) + 8, 10 + 20, 136, at(M, 136, 10) + 1, 10 - 18)
    o.kyotoY = [+at(K, 10, 179).toFixed(1), +at(K, 38, 90).toFixed(1), +at(K, -9, 77).toFixed(1)]
    o.monacoY = [+at(M, 111, -31).toFixed(1), +at(M, 136, 10).toFixed(1)]
    o.err = g.state.lastError || null
    return o
  })
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-dead.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
}
