async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2500))
    const m = g.manly
    const rows = []
    // sample the field across the break, at three carve settings, over time so
    // a wave is definitely under it at some of them
    let best = null
    for (let t = 0; t < 60; t++) {
      await new Promise(r => setTimeout(r, 220))
      for (let z = 10; z >= -44; z -= 2) {
        const a = m.flowProbe(0, z, 0)
        if (a.foam > (best ? best.foam : 0)) { const p0 = m.flowProbe(0, z, 1), n0 = m.flowProbe(0, z, -1); best = { z, foam: a.foam, vx0: a.x, vxP: p0.x, vxN: n0.x, vz0: a.z, vzP: p0.z } }
        if (a.foam < 0.25) continue
        const p = m.flowProbe(0, z, 1)
        const n = m.flowProbe(0, z, -1)
        const row = { z, foam: a.foam, vx0: a.x, vxP: p.x, vxN: n.x, vz0: a.z, vzP: p.z }
        if (!best || row.foam > best.foam) best = row
        if (rows.length < 8) rows.push(row)
      }
    }
    // ...and confirm the cut removes it
    g.state.noCarve = true
    const cut = best ? m.flowProbe(0, best.z, 1) : null
    g.state.noCarve = false
    return { rows, best, cut, err: g.state.lastError || null }
  })
  await page.evaluate(o => fetch('/shot?name=T4-flow.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
