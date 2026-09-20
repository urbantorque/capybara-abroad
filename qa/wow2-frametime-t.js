async page => {
  // ROADMAP-WOW2, T — the frame-time A/B for `noTut`.
  //
  // The walk is not a visual term and cannot be interleaved the way the
  // A/B template interleaves a shader flag: it arms ONCE, at Begin, and
  // `game.state.noTut` set mid-run ends it for good rather than cutting a
  // draw. So this is a BETWEEN-PAGE two-arm on the same page object, back
  // to back, in the same wall-clock minute, and it says so: arm A is a
  // fresh file with the walk live (the pills are up, the arrow is
  // borrowed, the tick runs every frame), arm B is the same fresh file
  // with `noTut` set before Begin. 5 x 60 frames each, Sydney, and the
  // third row is arm A again AFTER the walk has ended, which is the state
  // every frame of the other three hours is in — `tutLive()` is false and
  // the whole block is one boolean.
  //
  // Writes qa/wow2-frametime-t.json.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  // THE RUNG HAS TO MATCH OR THE TWO ARMS ARE TWO DIFFERENT RENDERERS.
  // MEASURED on the first cut of this: arm A settled at rung 3 (0.6 dpr,
  // 1024 shadow map, no far cascade) and arm B at rung 0, and the 3.2 ms
  // "delta" it printed was the governor, not the walk. The reps are
  // bucketed by rung now and only a rung both arms drew at is compared.
  const sample = () => page.evaluate(async () => {
    const g = window.__capy
    const frames = (n) => new Promise(res => { const t = []; let last = performance.now(); let k = 0
      const step = () => { const now = performance.now(); t.push(now - last); last = now; if (++k < n) requestAnimationFrame(step); else res(t) }
      requestAnimationFrame(step) })
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
    const p95 = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] }
    // The headless renderer does not sit at rung 0 at all, so the
    // reps are BUCKETED BY RUNG rather than demanded at one: each rep's
    // frames go in the bucket for the rung they were drawn at (a rep that
    // straddles a step is thrown away), and the comparison is made on a
    // rung both arms have frames in.
    const by = {}
    let tossed = 0
    for (let rep = 0; rep < 10; rep++) {
      await frames(10)
      const r0 = g.state.perfRung
      const t = await frames(60)
      if (r0 !== g.state.perfRung) { tossed++; continue }
      ;(by[r0] = by[r0] || []).push(...t)
    }
    const out = {}
    for (const r in by) out[r] = { n: by[r].length, med: +med(by[r]).toFixed(2), p95: +p95(by[r]).toFixed(2) }
    return { byRung: out, rung: g.state.perfRung, tossed: tossed,
             audit: g.tutAudit(), biome: g.biome.current }
  })
  async function arm(cut) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(600)
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.evaluate((c) => { if (c) window.__capy.state.noTut = true; const b = document.querySelector('.capyui-go'); if (b) b.click() }, cut)
    await page.waitForTimeout(6500)   // the first pill is up by 4.6 s
    return sample()
  }
  const out = { errs, live: await arm(false), cut: await arm(true) }
  // ...and a third arm: a fresh file whose walk has been SKIPPED (Escape,
  // then Escape again to resume), which is the state every frame of the
  // other three hours is in — `tutLive()` false, the block one boolean.
  await arm(false)
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  await page.keyboard.press('Escape'); await page.waitForTimeout(2500)
  out.after = await sample()
  // the comparison, on every rung both arms actually drew frames at
  out.delta = {}
  for (const r of Object.keys(out.cut.byRung)) {
    const c = out.cut.byRung[r]
    if (out.live.byRung[r]) out.delta['live-cut@rung' + r] = +(out.live.byRung[r].med - c.med).toFixed(2)
    if (out.after.byRung[r]) out.delta['after-cut@rung' + r] = +(out.after.byRung[r].med - c.med).toFixed(2)
  }
  // ...and live vs the SKIPPED file, which is the same code path noTut
  // takes (tutLive() false) and is the pair most likely to share a rung
  for (const r of Object.keys(out.after.byRung)) {
    if (out.live.byRung[r]) out.delta['live-after@rung' + r] = +(out.live.byRung[r].med - out.after.byRung[r].med).toFixed(2)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-frametime-t.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
