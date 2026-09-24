async page => {
  // THE PACK KEEPS ITS PASSENGER TOO (TEN T1b). A roof ride at a forced rung:
  // the animal put on the fastest pack car, no keys, and every 150 ms the car
  // drawn vs its body vs the track target, and whether the chapter still says
  // it is riding. Three legs per rung, rungs 3 then 0.
  const PORT = 5192
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(3000)
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'monaco') { g.state.journeyMode = 'free'; g.hud.cross('monaco'); await new Promise(r => setTimeout(r, 9000)) } })
  const out = { legs: [] }
  for (const rung of [3, 3, 0, 0]) {
    const leg = await page.evaluate(async (rung) => {
      const g = window.__capy, api = g.monaco
      g.state.perfRung = rung
      let cars = []; g.scene.traverse(x => { if (x.name === 'monCar') cars.push(x) })
      const bodies = g.world.bodies.filter(b => b.type === 4 && b.shapes.length === 5)
      // the fastest pack body, and the mesh nearest it
      let best = null, bv = -1
      for (const b of bodies) { const v = Math.hypot(b.velocity.x, b.velocity.z); if (v > bv) { bv = v; best = b } }
      let mesh = null, md = 1e9
      for (const m of cars) { const d = Math.hypot(m.position.x - best.position.x, m.position.z - best.position.z); if (d < md) { md = d; mesh = m } }
      const c = g.capy
      c.body.position.set(best.position.x, best.position.y + 1.35, best.position.z)
      c.body.velocity.set(best.velocity.x, 0, best.velocity.z)
      c.body.angularVelocity.setZero()
      c.body.previousPosition.copy(c.body.position); c.body.interpolatedPosition.copy(c.body.position)
      const rows = []
      const t0 = g.state.time
      for (let k = 0; k < 70; k++) {
        g.state.perfRung = rung
        await new Promise(r => setTimeout(r, 150))
        const p = c.position
        const dx = p.x - mesh.position.x, dz = p.z - mesh.position.z
        const cy = Math.cos(mesh.rotation.y), sy = Math.sin(mesh.rotation.y)
        rows.push({ t: +(g.state.time - t0).toFixed(2), riding: api.riding(), v: +Math.hypot(best.velocity.x, best.velocity.z).toFixed(1),
          lx: +(dx * cy - dz * sy).toFixed(2), lz: +(dx * sy + dz * cy).toFixed(2), dy: +(p.y - mesh.position.y).toFixed(2),
          meshBody: +Math.hypot(mesh.position.x - best.position.x, mesh.position.z - best.position.z).toFixed(2) })
      }
      const on = rows.filter(r => r.riding >= 0)
      const firstOff = rows.findIndex(r => r.riding < 0)
      return { rung, v0: +bv.toFixed(1), n: rows.length, onN: on.length, heldS: firstOff < 0 ? rows[rows.length - 1].t : rows[firstOff].t,
        maxMeshBody: Math.max(...rows.map(r => r.meshBody)), maxLz: Math.max(...on.map(r => Math.abs(r.lz)), 0), rows: rows.filter((r, i) => i % 7 === 0) }
    }, rung)
    out.legs.push(leg)
    if (out.legs.length === 2) await page.screenshot({ path: 'qa/ten-t1b-roof.png' })
  }
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t1b-roof.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
