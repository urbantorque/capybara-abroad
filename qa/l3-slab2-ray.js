async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = {}
  for (const [key, name] of [['Slash', 'hanoi'], ['Digit0', 'venice'], ['Equal', 'palawan']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    out[name] = await page.evaluate((nm) => {
      const g = window.__capy
      const root = g.scene.children.find(c => c.name === nm)
      const meshes = []
      root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.index) meshes.push([o.name || '', o.geometry.index.count / 3]) })
      meshes.sort((a, b) => b[1] - a[1])
      g.tick(1 / 60, true)
      const r = g.renderer.info.render
      return { calls: r.calls, tris: r.triangles, meshes: meshes.slice(0, 10), err: g.state.lastError || null }
    }, name)
    if (name === 'hanoi') await page.screenshot({ path: 'qa/l3-slab2-hanoi.png' })
  }
  await page.evaluate((o) => fetch('/shot?name=l3-slab2-ray.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
