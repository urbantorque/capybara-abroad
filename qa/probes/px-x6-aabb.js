async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const CH = ['hanoi', 'venice', 'kyoto', 'quay', 'cali', 'goreme']

  // THE DIRECT TEST. A local is mass 0 with no type, i.e. STATIC, and cannon
  // only recomputes a body's AABB when aabbNeedsUpdate is set — which for a
  // static body nothing ever sets, because Body.integrate returns early before
  // reaching that line. So a local that has walked away from its spawn keeps
  // the broadphase box it was born with, and is solid THERE and nowhere else.
  // Comparing the AABB's centre against the body's actual position measures
  // exactly that, with no walking and no rig to lie about it.
  const R = () => {
    const g = window.__capy
    const rows = []
    // LOCALS ARE NOT IN game.npcs — npc.js keeps them in a module-local array
    // (`const locals = []`), and only the Sydney/Pasto casts are pushed to
    // game.npcs. Reading game.npcs found ZERO locals in all six chapters and
    // reported a clean sweep for a bug that was still there. Their bodies carry
    // userData.local, so the world is the honest place to look.
    for (const b of g.world.bodies) {
      const r = b.userData && b.userData.local
      if (!r) continue
      if (b.type !== undefined && g.CANNON && b.type !== g.CANNON.Body.STATIC) continue
      if (!b.aabb || !b.aabb.lowerBound) continue
      const cx = (b.aabb.lowerBound.x + b.aabb.upperBound.x) * 0.5
      const cz = (b.aabb.lowerBound.z + b.aabb.upperBound.z) * 0.5
      const off = Math.hypot(cx - b.position.x, cz - b.position.z)
      const moved = (r.ax !== undefined && r.az !== undefined)
        ? Math.hypot(b.position.x - r.ax, b.position.z - r.az) : null
      rows.push({ off: +off.toFixed(2), moved: moved === null ? null : +moved.toFixed(2),
                  own: !!r.own, state: r.state || '' })
    }
    const bad = rows.filter(x => x.off > 0.25)
    const mv = rows.filter(x => x.moved !== null && x.moved > 0.25)
    return {
      nm: g.biome.current, locals: rows.length,
      moved: mv.length,
      staleAABB: bad.length,
      worstOff: rows.length ? +Math.max(...rows.map(x => x.off)).toFixed(2) : 0,
      worstMoved: mv.length ? +Math.max(...mv.map(x => x.moved)).toFixed(2) : 0
    }
  }

  for (const ch of CH) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(3600)
      // Let the locals shuffle and fetch things for a while — IN CHUNKS. One
      // evaluate of 3600 ticks runs past the ~20-30 s ceiling on a single
      // page.evaluate and dies with "execution context was destroyed", which
      // looks exactly like a probe that hung.
      for (let k = 0; k < 6; k++) {
        await page.evaluate(() => { const g = window.__capy; for (let i = 0; i < 600; i++) g.tick(1 / 60, false) })
      }
      out.rows.push(await page.evaluate(R))
    } catch (e) { out.rows.push({ nm: ch, error: String(e).slice(0, 180) }) }
  }
  await page.evaluate(o => fetch('/shot?name=px-x6-aabb.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
