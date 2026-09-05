// THE DIVE VERB, WHICH px-cam-v.js NEVER REACHED.
//
// X9 measured the eye raise SUBMERGED and said so plainly, because `capy.diving`
// stayed false throughout: the probe pinned the body at depth every 16 ms, and a
// pinned body is not a diving one. The dive is `capySwimming && capyCanDive() &&
// input.action` (capybara.js:3596), so it wants a FLOATING animal that presses E,
// not a held one.
//
// So: float first, press E, ASSERT capy.diving before believing a single number,
// and only then hold V. No pin at all - the dive owns the animal's depth, which
// is the whole point.
async page => {
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(4500)
  await page.keyboard.press('Equal')          // 12 = palawan
  await page.waitForTimeout(7000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)

  const SAMPLE = () => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera, p = g.capy.position
    const f = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    return {
      eyeUp: +(cam.position.y - p.y).toFixed(3),
      pitch: +(Math.asin(Math.max(-1, Math.min(1, f.y))) * 180 / Math.PI).toFixed(2),
      dist: +Math.hypot(cam.position.x - p.x, cam.position.y - p.y, cam.position.z - p.z).toFixed(3),
      capY: +p.y.toFixed(3), swimming: !!g.capy.swimming, diving: !!g.capy.diving,
      depth: +(g.capy.depth || 0).toFixed(2)
    }
  }

  // drop into deep water and let it float, no pin
  out.spot = await page.evaluate(() => {
    const g = window.__capy, a = g.palawan
    for (let r = 20; r < 160; r += 4) {
      for (let t = 0; t < 12; t++) {
        const x = Math.cos(t) * r, z = Math.sin(t) * r
        if (a.isOverWater && a.isOverWater(x, z) && a.terrainHeight(x, z) < -4) {
          const b = g.capy.body
          b.position.set(x, 0.4, z); b.velocity.set(0, 0, 0)
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
          b.aabbNeedsUpdate = true
          return { x: +x.toFixed(1), z: +z.toFixed(1), t: +a.terrainHeight(x, z).toFixed(2) }
        }
      }
    }
    return null
  })
  await page.waitForTimeout(2500)
  out.floating = await page.evaluate(SAMPLE)

  // E is the dive. HOLD it - a 10 ms press against a 16.7 ms frame can be missed
  // entirely by an input flag assembled once per tick - and POLL, so a dive that
  // latches and is cancelled again is still seen rather than sampled past.
  await page.evaluate(() => {
    const g = window.__capy
    window.__dv = { everDiving: false, n: 0, maxDepth: 0 }
    if (window.__dvT) clearInterval(window.__dvT)
    window.__dvT = setInterval(() => {
      window.__dv.n++
      if (g.capy.diving) window.__dv.everDiving = true
      if ((g.capy.depth || 0) > window.__dv.maxDepth) window.__dv.maxDepth = +(g.capy.depth).toFixed(2)
    }, 30)
  })
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(800)
  out.afterE = await page.evaluate(SAMPLE)
  out.poll = await page.evaluate(() => window.__dv)

  await page.keyboard.up('KeyE')
  if (!out.afterE.diving) {
    out.note = 'E did not start a dive; nothing below is a dive measurement'
  } else {
    // A DIVING ANIMAL IS DESCENDING, so the lens is moving anyway and a
    // before/after pair around a V press measures the descent as much as the
    // key. Run the same dive TWICE on the same clock - once holding V, once not -
    // and take the difference of the differences. Without the control leg the
    // +7.65 degrees this first read is uninterpretable.
    const leg = async (useV) => {
      // back to the surface and re-dive, so both legs start identically
      await page.evaluate(a => {
        const g = window.__capy, b = g.capy.body
        b.position.set(a.x, 0.4, a.z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        b.aabbNeedsUpdate = true
      }, out.spot)
      await page.waitForTimeout(2500)
      await page.keyboard.down('KeyE')
      await page.waitForTimeout(800)
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(900)
      const t0 = await page.evaluate(SAMPLE)
      if (useV) await page.keyboard.down('KeyV')
      await page.waitForTimeout(1400)
      const t1 = await page.evaluate(SAMPLE)
      if (useV) await page.keyboard.up('KeyV')
      await page.keyboard.up('KeyW')
      await page.keyboard.up('KeyE')
      await page.waitForTimeout(1200)
      return { t0, t1,
        dPitch: +(t1.pitch - t0.pitch).toFixed(2),
        dEyeUp: +(t1.eyeUp - t0.eyeUp).toFixed(3),
        dDist: +(t1.dist - t0.dist).toFixed(3),
        dDepth: +(t1.depth - t0.depth).toFixed(2),
        bothDiving: t0.diving && t1.diving }
    }
    out.diveWithV = await leg(true)
    out.diveNoV = await leg(false)
    out.attributable = {
      pitch: +(out.diveWithV.dPitch - out.diveNoV.dPitch).toFixed(2),
      eyeUp: +(out.diveWithV.dEyeUp - out.diveNoV.dEyeUp).toFixed(3),
      dist: +(out.diveWithV.dDist - out.diveNoV.dDist).toFixed(3),
      depthDiff: +(out.diveWithV.dDepth - out.diveNoV.dDepth).toFixed(2),
      bothLegsDiving: out.diveWithV.bothDiving && out.diveNoV.bothDiving
    }
  }
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null)
  await page.evaluate(o => fetch('/shot?name=px-cam-dive.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
