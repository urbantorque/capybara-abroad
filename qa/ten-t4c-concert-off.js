async page => {
  // T4c, noConcertBeat: THE CONCERT ON THE BEAT. Fresh profile, Sydney, the
  // animal held on the red. Three wheeks through the real key path (Q down,
  // the inhale, the call, env.stageNote) timed in-page off env.beatAudit():
  // MODE 'on' presses as the rings meet, 'off' presses half a beat away.
  // Reads: the ring before the first note, the judge per note, the carry, the
  // house (peak over 22 s), the tick, the shells on the tick, the carpet props
  // kicked, and — MODE 'on' only — the sails' luminance before and after the
  // notes in the opera shot, masked by hiding the shells (hide-and-diff).
  // prefs pf 1 pins the governor at rung 0. Copy to -off with MODE = 'off'.
  const PORT = 5193, MODE = 'off', NAME = 'ten-t4c-concert-' + MODE
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capy && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  const out = { mode: MODE, started: await page.evaluate(() => !!window.__capy.state.started) }
  // hold the animal on the red, facing the forecourt
  await page.evaluate(() => {
    const g = window.__capy
    g.__t4cHold = setInterval(() => {
      const b = g.capy.body
      const dx = b.position.x - 0, dz = b.position.z - 1.6
      if (dx * dx + dz * dz > 0.25 || b.position.y < 1.4) {
        b.position.set(0, 1.9, 1.6); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      }
    }, 100)
  })
  await page.waitForTimeout(2500)
  const shotB64 = async (k) => (await page.screenshot({ path: 'qa/' + NAME + '-' + k + '.png', timeout: 90000 })).toString('base64')
  const audit = () => page.evaluate(() => {
    const g = window.__capy, e = g.env
    return { beat: e.beatAudit(), concert: e.concertAudit(), coming: g.concert.house(true), rung: g.state.perfRung,
             wow: (document.querySelector('.capyui-marq .capyui-marqlive') || {}).textContent || '',
             sparks: typeof g.sparksLive === 'function' ? g.sparksLive() : -1, done: g.taskDone('opera-stage') }
  })
  const carpet = () => page.evaluate(() => (window.__capy.props || []).filter(p => p && p.body && (p.type === 'bin' || p.type === 'cone' || p.type === 'sign') &&
    Math.abs(p.body.position.x) < 9 && p.body.position.z > -2 && p.body.position.z < 9).map(p => [p.type, +p.body.position.x.toFixed(2), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(2)]))
  out.pre = await audit()
  out.carpet0 = await carpet()
  await page.screenshot({ path: 'qa/' + NAME + '-ring.png', timeout: 90000 })
  let pre = null, mask = null
  if (MODE === 'on') {
    await page.evaluate(() => window.__capy.env.operaShot(4))
    await page.waitForTimeout(2600)
    pre = await shotB64('pre')
    await page.evaluate(() => { const g = window.__capy, gl = g.scene.getObjectByName('envSailGlow'); g.scene.traverse(o => { if (o.isMesh && gl && o !== gl && o.geometry === gl.geometry) { o.visible = false; g.__t4cShell = o } }) })
    await page.waitForTimeout(150)
    mask = await shotB64('mask')
    await page.evaluate(() => { const g = window.__capy; if (g.__t4cShell) g.__t4cShell.visible = true })
    await page.waitForTimeout(1500)
  }
  out.notes = []
  for (let n = 1; n <= 3; n++) {
    const r = await page.evaluate(async (mode) => {
      const g = window.__capy, e = g.env
      const want = mode === 'on' ? 0 : 0.42          // where the PRESS sits against the beat, s
      const t0 = performance.now()
      await new Promise(res => {
        const f = () => {
          const a = e.beatAudit()
          const d = (((a.t - want) % a.beat) + a.beat) % a.beat
          if (d < 0.05 || performance.now() - t0 > 4000) res(); else requestAnimationFrame(f)
        }
        f()
      })
      const at = e.beatAudit().t
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true }))
      await new Promise(r => setTimeout(r, 90))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q', bubbles: true }))
      await new Promise(r => setTimeout(r, 700))
      return { pressT: +at.toFixed(3), beat: e.beatAudit(), concert: e.concertAudit(), coming: g.concert.house(true) }
    }, MODE)
    out.notes.push(r)
    if (n === 1) { await page.waitForTimeout(1500); out.carpet1 = await carpet() }
    await page.waitForTimeout(n === 1 ? 1600 : 3100)
  }
  // the house arrives: peak over 22 s (npcCONCERT_CEIL)
  out.samples = []
  let peak = 0
  for (let i = 0; i < 11; i++) {
    const a = await audit()
    peak = Math.max(peak, a.concert.house)
    out.samples.push([a.concert.house, a.coming, a.concert.done, a.sparks, a.beat.sail, a.beat.ring])
    if (i === 1 && MODE === 'on') {
      await page.evaluate(() => window.__capy.env.operaShot(4))
      await page.waitForTimeout(2600)
      const post = await shotB64('post')
      out.sails = await page.evaluate(async ({ pre, mask, post }) => {
        const load = b => new Promise(r => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); r(x.getImageData(0, 0, im.width, im.height).data) }; im.src = 'data:image/png;base64,' + b })
        const A = await load(pre), M = await load(mask), B = await load(post)
        const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        let n = 0, la = 0, lb = 0
        for (let i = 0; i < A.length; i += 4) {
          if (Math.abs(L(A, i) - L(M, i)) < 24) continue      // not a sail pixel
          n++; la += L(A, i); lb += L(B, i)
        }
        return { px: n, before: +(la / Math.max(1, n)).toFixed(1), after: +(lb / Math.max(1, n)).toFixed(1), gain: +((lb / Math.max(1, la) - 1) * 100).toFixed(1) }
      }, { pre, mask, post })
      await page.screenshot({ path: 'qa/' + NAME + '-sails.png', timeout: 90000 })
    } else await page.waitForTimeout(1800)
  }
  out.peak = peak
  out.post = await audit()
  out.enc = await page.evaluate(() => window.__capy.env.encoreAudit())
  out.record = await page.evaluate(() => { try { return window.__capy.hud.recordAudit().best['opera-stage'] } catch (e) { return null } })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(() => clearInterval(window.__capy.__t4cHold))
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
