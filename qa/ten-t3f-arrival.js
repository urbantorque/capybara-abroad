async page => {
  // THE ARRIVAL FRAME IN MONG KOK (TEN T3f). Fresh profile, Kowloon entered,
  // the lens left where the arrival puts it. A PNG, and every emissive mesh
  // whose centre lands in the middle of the frame, by size, colour and
  // position — which is how the blank magenta panel is found by name rather
  // than by guessing at the builder.
  const PORT = 5196
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('kowloon'); await new Promise(r => setTimeout(r, 9000)) })
  const tag = await page.evaluate(() => window.__t3fTag || 'a')
  await page.screenshot({ path: 'qa/ten-t3f-arrival-' + tag + '.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera
    cam.updateMatrixWorld()
    const res = []
    const v = new T.Vector3(), box = new T.Box3(), sz = new T.Vector3()
    g.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh) return
      let vis = true, q = o; while (q) { if (!q.visible) { vis = false; break } q = q.parent }
      if (!vis) return
      const m = Array.isArray(o.material) ? o.material[0] : o.material
      if (!m || !m.emissive || (m.emissiveIntensity || 0) <= 0) return
      if (m.emissive.r + m.emissive.g + m.emissive.b < 0.05) return
      box.setFromObject(o); box.getCenter(v); box.getSize(sz)
      const c = v.clone().project(cam)
      if (c.z > 1 || Math.abs(c.x) > 0.6 || Math.abs(c.y) > 0.8) return
      res.push({ name: o.name, parent: o.parent && o.parent.name, emis: '#' + m.emissive.getHexString(), ei: +m.emissiveIntensity.toFixed(2),
        c: [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)], size: [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)],
        ndc: [+c.x.toFixed(2), +c.y.toFixed(2)], kids: o.parent ? o.parent.children.length : 0 })
    })
    return { cam: [cam.position.x, cam.position.y, cam.position.z].map(x => +x.toFixed(2)), capy: [g.capy.position.x, g.capy.position.y, g.capy.position.z].map(x => +x.toFixed(2)), rung: g.state.perfRung, res }
  })
  await page.evaluate(o => fetch('/shot?name=ten-t3f-arrival.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
