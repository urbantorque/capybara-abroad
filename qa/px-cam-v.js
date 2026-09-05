// THE ONE CAMERA MEASUREMENT THE 4 SEP AUDIT LEFT OPEN.
//
// audit-controls-camera.md, still marked "measurements pending", says of the eye
// raise: "Works while swimming/climbing/diving in code (no gate) but the dive
// rig (rigT) applies AFTER skyT and lerps pitch to sysDIVE_RIG_P, so V underwater
// is largely overridden - to measure."
//
// So measure it. One place, one pinned animal, three states - standing, swimming
// at the surface, and diving - and V held against V not held in each. A pinned
// position is the only way to read a camera change: px-cam-walls walks the animal
// and cannot resolve one (X7 measured it moving occ 78 -> 92 on legs where the
// change under test provably could not act).
async page => {
  const out = { errs: [], states: {} }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(4500)
  await page.keyboard.press('Equal')          // 12 = palawan, the diving chapter
  await page.waitForTimeout(7000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)

  const SAMPLE = () => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera, p = g.capy.position
    const f = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    return {
      camY: +cam.position.y.toFixed(3),
      capY: +p.y.toFixed(3),
      eyeUp: +(cam.position.y - p.y).toFixed(3),
      // the lens's own pitch, in degrees: negative is looking down
      pitch: +(Math.asin(Math.max(-1, Math.min(1, f.y))) * 180 / Math.PI).toFixed(2),
      dist: +Math.hypot(cam.position.x - p.x, cam.position.y - p.y, cam.position.z - p.z).toFixed(3),
      swimming: !!g.capy.swimming, diving: !!g.capy.diving,
      depth: +(g.capy.depth || 0).toFixed(2)
    }
  }

  // a deep-water spot the chapter itself agrees is water
  const spot = await page.evaluate(() => {
    const a = window.__capy.palawan
    for (let r = 20; r < 160; r += 4) {
      for (let t = 0; t < 12; t++) {
        const x = Math.cos(t) * r, z = Math.sin(t) * r
        if (a.isOverWater && a.isOverWater(x, z) && a.terrainHeight(x, z) < -3) return { x, z, t: a.terrainHeight(x, z) }
      }
    }
    return null
  })
  out.spot = spot

  const pin = async (x, y, z) => page.evaluate(a => {
    const g = window.__capy, b = g.capy.body
    window.__pin = a
    if (window.__pinT) clearInterval(window.__pinT)
    window.__pinT = setInterval(() => {
      const q = window.__pin; if (!q) return
      b.position.set(q.x, q.y, q.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, 16)
  }, { x, y, z })

  const pair = async (label, setup) => {
    await setup()
    await page.waitForTimeout(2200)
    const off = await page.evaluate(SAMPLE)
    await page.keyboard.down('KeyV')
    await page.waitForTimeout(2200)
    const on = await page.evaluate(SAMPLE)
    await page.keyboard.up('KeyV')
    await page.waitForTimeout(1200)
    out.states[label] = { off, on,
      dEyeUp: +(on.eyeUp - off.eyeUp).toFixed(3),
      dPitch: +(on.pitch - off.pitch).toFixed(2),
      dDist: +(on.dist - off.dist).toFixed(3) }
  }

  // 1. standing on land
  await pair('land', async () => {
    await page.evaluate(() => {
      const g = window.__capy, a = g.palawan, sp = a.SPAWN || { x: 0, z: 0 }
      const h = a.terrainHeight(sp.x, sp.z)
      const b = g.capy.body
      if (window.__pinT) clearInterval(window.__pinT)
      b.position.set(sp.x, (h === h ? h : 0) + 0.5, sp.z); b.velocity.set(0, 0, 0)
      b.aabbNeedsUpdate = true
    })
  })

  // 2. swimming at the surface
  if (spot) {
    await pair('swim', async () => { await pin(spot.x, 0.0, spot.z) })
    // 3. diving: E is the verb, then hold the animal down at depth
    await pair('dive', async () => {
      await pin(spot.x, -1.6, spot.z)
      await page.waitForTimeout(900)
      await page.keyboard.press('KeyE')
      await page.waitForTimeout(900)
    })
  }
  await page.evaluate(() => { if (window.__pinT) clearInterval(window.__pinT) })
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null)
  await page.evaluate(o => fetch('/shot?name=px-cam-v.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
