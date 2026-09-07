async page => {
  // ---------------------------------------------------------------------------
  // qa/arrive-see.js — IS THE MARQUEE IN THE ARRIVAL FRAME? (ROADMAP-FUN, 1a)
  //
  // The arrival is the ONE shot every player of a chapter sees, and F1 composed
  // all nineteen of them — at the animal. This asks the other question: with the
  // composition still pinned, is the thing the chapter exists for anywhere on
  // the screen? It is the number item 1a (the glimpse, B2) has to move, and the
  // baseline it is measured against is written by this file.
  //
  // Sampled 2.2 s into the 3.60 s arrival shot, which is inside the hold and
  // after the ease-in — `framing` is reported so a row taken while the rig had
  // already handed the lens back is visible as one rather than counted.
  //
  // The occlusion test walks the PARENTS for visibility. A detached biome's
  // root is hidden and its children keep visible === true, so a test that reads
  // the flag on the hit object alone names `pastoChurch` as the occluder in
  // Palawan, Cappadocia and Antarctica. Measured, first cut of this file.
  // ---------------------------------------------------------------------------
  const ORDER = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  // Chapter 10, so the first `hud.cross` below is a real crossing and not a
  // no-op on the chapter that is already live.
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(7000)

  const rows = []
  for (const b of ORDER) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(3600)      // 1.28 white + 0.55 ease-in + ~1.8 hold
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const THREE = g.THREE
      const m = g.marqueePoint()
      if (!m) return { biome: g.biome.current, want: arg.b, point: null }
      const c = g.capy.position
      const p = new THREE.Vector3(m.x, m.y, m.z)
      const ndc = p.clone().project(g.camera)
      function drawn(o) { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true }
      const cam = g.camera.position
      const dir = p.clone().sub(cam)
      const len = dir.length()
      dir.normalize()
      const rc = new THREE.Raycaster(cam.clone(), dir, 0.6, Math.max(1, len - 1.5))
      let blocked = ''
      try {
        const hits = rc.intersectObjects(g.scene.children, true)
        for (let i = 0; i < hits.length; i++) {
          const o = hits[i].object
          if (!o.isMesh || !o.material || !drawn(o)) continue
          if (o.material.transparent && o.material.opacity < 0.5) continue
          const bs = o.geometry && o.geometry.boundingSphere
          if (bs && bs.radius > 400) continue
          blocked = (o.name || o.type) + '@' + hits[i].distance.toFixed(0)
          break
        }
      } catch (e) { blocked = 'THREW' }
      const inFrame = Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1
      return {
        biome: g.biome.current, want: arg.b,
        point: { x: +m.x.toFixed(1), y: +m.y.toFixed(1), z: +m.z.toFixed(1), live: !!m.live },
        dist: +Math.hypot(m.x - c.x, m.z - c.z).toFixed(1),
        ndc: { x: +ndc.x.toFixed(3), y: +ndc.y.toFixed(3), z: +ndc.z.toFixed(4) },
        inFrame: inFrame, seen: inFrame && !blocked, blocked: blocked,
        framing: +g.framing().toFixed(2),
        err: g.state.lastError || null
      }
    }, { b: b })
    rows.push(r)
    await page.screenshot({ path: 'qa/AS-' + b + '.png' })
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=arrive-see.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
