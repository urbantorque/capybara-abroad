async page => {
  // x2-heli: the helicopter. Onto the roof, E at the H, then an autopilot on
  // the keys (A/D to the bearing, W when roughly aligned, Space when the ring
  // is higher) through all eight rings; expect the finale and the tick.
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(3500)
  const tp = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__capy; const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [x, y, z])
  const live = () => page.evaluate(() => { const m = document.querySelector('.capyui-marq'); const td = document.querySelector('.capyui-todo'); return (m ? m.className.replace('capyui-marq', '').trim() + ' | ' : '') + ((document.querySelector('.capyui-marqlive') || {}).textContent || '') + ' | ' + (td ? td.className + ' ' + (td.querySelector('.capyui-part') || {}).textContent + ' ' + (td.querySelector('.capyui-kick') || {}).textContent : '') + ' | paused=' + window.__capy.state.paused + ' done=' + window.__capy.taskDone('symphony') })
  const heli = () => page.evaluate(() => window.__capy.kowloon.heli())
  await page.evaluate(() => window.__capy.biome.switchTo('kowloon')); await page.waitForTimeout(3500)
  const pad = await page.evaluate(() => window.__capy.kowloon.heliPad)
  await tp(pad.x + 2.6, pad.y + 1.0, pad.z + 1); await page.waitForTimeout(1200)
  const out = { pad: pad, before: await heli() }
  await page.keyboard.press('KeyE'); await page.waitForTimeout(600)
  out.took = await heli()
  out.toast0 = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/x2-pad.png' })
  const held = {}
  const set = async (code, on) => { if (!!held[code] === on) return; held[code] = on; if (on) await page.keyboard.down(code); else await page.keyboard.up(code) }
  const samples = []
  let ticked = false, t0 = Date.now(), shot = false
  while (Date.now() - t0 < 150000) {
    const st = await page.evaluate(() => {
      const g = window.__capy; const h = g.kowloon.heli()
      if (h.done) return { h: h, done: true }
      const r = g.kowloon.ringAt(h.ring)
      let want = Math.atan2(r.x - h.x, r.z - h.z), d = want - h.yaw
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2
      return { h: h, diff: d, up: r.y - h.y, dist: Math.hypot(r.x - h.x, r.z - h.z) }
    })
    if (st.done) { await set('KeyW', false); await set('Space', false); break }
    await set('KeyA', st.diff > 0.12)
    await set('KeyD', st.diff < -0.12)
    await set('KeyW', Math.abs(st.diff) < 0.7)
    await set('Space', st.up > 0.8)
    if ((Date.now() - t0) % 1000 < 220) samples.push({ t: Math.round((Date.now() - t0) / 1000), ring: st.h.ring, x: +st.h.x.toFixed(0), y: +st.h.y.toFixed(0), z: +st.h.z.toFixed(0), dist: +st.dist.toFixed(0), up: +st.up.toFixed(0), line: await live() })
    if (!shot && st.h.ring >= 2) { shot = true; await page.screenshot({ path: 'qa/x2-ring.png' }) }
    await page.waitForTimeout(120)
  }
  for (const k of Object.keys(held)) await set(k, false)
  out.samples = samples
  out.flown = await heli()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'qa/x2-finale.png' })
  await page.waitForTimeout(6000)
  out.ticked = await page.evaluate(() => window.__capy.taskDone('symphony'))
  out.show = await page.evaluate(() => { const k = window.__capy.kowloon; return { showing: k.showing(), line: (document.querySelector('.capyui-marqlive') || {}).textContent } })
  out.toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
  // fly home and get out: autopilot to the pad
  t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    const st = await page.evaluate(() => {
      const g = window.__capy; const h = g.kowloon.heli(); const p = g.kowloon.heliPad
      let want = Math.atan2(p.x - h.x, p.z - h.z), d = want - h.yaw
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2
      return { diff: d, dist: Math.hypot(p.x - h.x, p.z - h.z), up: (p.y + 12) - h.y, y: h.y }
    })
    if (st.dist < 3 && st.y < pad.y + 0.7) break
    await set('KeyA', st.dist > 3 && st.diff > 0.12)
    await set('KeyD', st.dist > 3 && st.diff < -0.12)
    await set('KeyW', st.dist > 3 && Math.abs(st.diff) < 0.7 && !(st.dist < 12 && st.y > pad.y + 6))
    await set('Space', st.dist > 6 && st.up > 0.8)
    await page.waitForTimeout(120)
  }
  for (const k of Object.keys(held)) await set(k, false)
  await page.waitForTimeout(1500)
  out.home = await heli()
  await page.keyboard.press('KeyE'); await page.waitForTimeout(600)
  out.left = await page.evaluate(() => { const c = window.__capy.capy; const p = c.position; return { p: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], atHelm: c.atHelm, heliOn: window.__capy.kowloon.heli().on } })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=x2heli.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
