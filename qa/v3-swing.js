async page => {
  // v3-swing.js — DO BUBBLES SWING? Sample every visible bubble's rendered
  // left edge at 60 Hz for a while in three crowded chapters, and for each
  // bubble count DIRECTION REVERSALS of its horizontal motion and the
  // peak-to-peak travel while it is up. A bubble that is stable reverses
  // zero or one times (it slides once to dodge and stays); a bubble that
  // swings reverses every few frames.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  for (const b of ['sahara', 'venice', 'kowloon']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    await page.evaluate(() => {
      // one record per bubble ELEMENT while it is continuously visible
      window.__sw = { tracks: new Map(), done: [] }
      const step = function () {
        const els = document.querySelectorAll('div[style]')
        const seen = new Set()
        for (let i = 0; i < els.length; i++) {
          const e = els[i]
          if (e.className) continue
          if (e.style.position !== 'absolute' || e.style.display === 'none') continue
          const t = (e.textContent || '').trim()
          if (!t || t.length > 140) continue
          const r = e.getBoundingClientRect()
          if (r.width < 30 || r.height < 10) continue
          seen.add(e)
          let tr = window.__sw.tracks.get(e)
          if (!tr) { tr = { text: t.slice(0, 30), xs: [], n: 0 }; window.__sw.tracks.set(e, tr) }
          tr.xs.push(r.left); tr.n++
        }
        for (const [e, tr] of window.__sw.tracks) {
          if (seen.has(e)) continue
          window.__sw.tracks.delete(e)
          if (tr.n < 20) continue
          let rev = 0, lastDir = 0, lo = 1e9, hi = -1e9, moves = 0, zig = 0, lastRevK = -99, legStart = tr.xs[0]
          for (let k = 1; k < tr.xs.length; k++) {
            const d = tr.xs[k] - tr.xs[k - 1]
            lo = Math.min(lo, tr.xs[k]); hi = Math.max(hi, tr.xs[k])
            if (Math.abs(d) < 0.5) continue
            moves++
            const dir = d > 0 ? 1 : -1
            if (lastDir && dir !== lastDir) {
              rev++
              // a ZIGZAG: this reversal within a quarter second of the last
              // one, and the leg between them at least 6 px — a swing, not a
              // speaker turning round or a camera stopping
              if (k - lastRevK < 15 && Math.abs(tr.xs[k - 1] - legStart) >= 6) zig++
              lastRevK = k; legStart = tr.xs[k - 1]
            }
            lastDir = dir
          }
          window.__sw.done.push({ text: tr.text, frames: tr.n, rev: rev, zig: zig, moves: moves, pp: Math.round(hi - lo) })
        }
        window.__swR = requestAnimationFrame(step)
      }
      window.__swR = requestAnimationFrame(step)
    })
    for (let k = 0; k < 10; k++) {
      await page.keyboard.press('KeyQ')
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(1600)
      await page.keyboard.up('KeyW')
      await page.waitForTimeout(3000)
    }
    out.rows.push(await page.evaluate(() => {
      cancelAnimationFrame(window.__swR)
      const g = window.__capy
      const d = window.__sw.done
      const swingers = d.filter(function (t) { return t.zig >= 2 })
      let revSum = 0, ppMax = 0, zigSum = 0
      for (const t of d) { revSum += t.rev; zigSum += t.zig; ppMax = Math.max(ppMax, t.pp) }
      return { cur: g.biome.current, bubbles: d.length, swingers: swingers.length,
               revPerBubble: d.length ? +(revSum / d.length).toFixed(2) : 0,
               zigPerBubble: d.length ? +(zigSum / d.length).toFixed(2) : 0, ppMax: ppMax,
               worst: d.slice().sort(function (a, b) { return b.zig - a.zig }).slice(0, 4),
               err: g.state.lastError || null }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=v3swing.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
