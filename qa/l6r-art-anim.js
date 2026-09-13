async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: await page.evaluate(() => window.__capy.state.started) }
  // px per metre at the animal, from its projected box
  const pxm = () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const box = new T.Box3().setFromObject(g.capy.group)
    const H = g.renderer.domElement.height
    const a = box.min.clone().project(g.camera), b = new T.Vector3(box.min.x, box.max.y, box.min.z).project(g.camera)
    return { pxPerM: +(Math.abs(a.y - b.y) * 0.5 * H / (box.max.y - box.min.y)).toFixed(0), h: +(box.max.y - box.min.y).toFixed(2), dist: +(g.camInfo.dist || 0).toFixed(1) }
  })
  // 1. REST: sample the secondary channels for 6 s at 60 Hz
  await page.waitForTimeout(12000)
  out.restPx = await pxm()
  out.rest = await page.evaluate(() => new Promise(res => {
    const g = window.__capy; const rows = []; const t0 = performance.now()
    let blinks = 0, lastB = 0
    const tick = () => {
      const a = g.capy.animAudit()
      rows.push([a.breath, a.tail, a.earZ, a.headX, a.modelY, a.eyeOpen, a.mood, a.blink])
      if (a.blink > 0.5 && lastB <= 0.5) blinks++; lastB = a.blink
      if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else {
        const col = i => rows.map(r => r[i]); const rng = i => { const c = col(i); return +(Math.max(...c) - Math.min(...c)).toFixed(4) }
        res({ n: rows.length, breathRange: rng(0), tailRange: rng(1), earRange: rng(2), headXRange: rng(3), modelYRange: rng(4), eyeOpenRange: rng(5), moodRange: rng(6), blinks, idle: g.camInfo.idle, rest: g.camInfo.rest })
      }
    }
    tick()
  }))
  // 2. THE JUMP: press Space, sample modelY / pop / grounded at rAF for 1.6 s
  out.jump = await page.evaluate(() => new Promise(res => {
    const g = window.__capy; const rows = []; const t0 = performance.now()
    const tick = () => {
      const a = g.capy.animAudit(); const t = (performance.now() - t0) / 1000
      rows.push({ t: +t.toFixed(3), y: +g.capy.position.y.toFixed(3), pop: +a.pop.toFixed(3), land: +a.land.toFixed(3), gr: a.grounded ? 1 : 0, vy: +a.vy.toFixed(2), headX: +a.headX.toFixed(2), earZ: +a.earZ.toFixed(2) })
      if (t < 1.8) requestAnimationFrame(tick); else res(rows)
    }
    tick()
  }).then(p => p))
  // fire the key a tick after the sampler starts
  await page.keyboard.press('Space')
  await page.waitForTimeout(2000)
  out.jump2 = await Promise.all([
    page.evaluate(() => new Promise(res => {
      const g = window.__capy; const rows = []; const t0 = performance.now()
      const tick = () => {
        const a = g.capy.animAudit(); const t = (performance.now() - t0) / 1000
        rows.push({ t: +t.toFixed(3), y: +g.capy.position.y.toFixed(3), pop: +a.pop.toFixed(3), land: +a.land.toFixed(3), gr: a.grounded ? 1 : 0, vy: +a.vy.toFixed(2), headX: +a.headX.toFixed(2), earZ: +a.earZ.toFixed(2), sy: +g.capy.group.children[0].scale.y.toFixed(3) })
        if (t < 1.8) requestAnimationFrame(tick); else res(rows)
      }
      tick()
    })),
    (async () => { await page.waitForTimeout(150); await page.keyboard.press('Space') })()
  ]).then(r => r[0])
  // 3. THE WHEEK: Q, sample jaw / tail / ear / mood / headX for 1.5 s
  out.wheek = await Promise.all([
    page.evaluate(() => new Promise(res => {
      const g = window.__capy; const rows = []; const t0 = performance.now()
      const tick = () => {
        const a = g.capy.animAudit(); const t = (performance.now() - t0) / 1000
        rows.push({ t: +t.toFixed(3), tail: +a.tail.toFixed(3), earZ: +a.earZ.toFixed(2), headX: +a.headX.toFixed(2), mood: +a.mood.toFixed(2), eye: +a.eyeOpen.toFixed(3), y: +a.modelY.toFixed(3) })
        if (t < 1.5) requestAnimationFrame(tick); else res(rows)
      }
      tick()
    })),
    (async () => { await page.waitForTimeout(150); await page.keyboard.press('KeyQ') })()
  ]).then(r => r[0])
  await page.waitForTimeout(1500)
  // 4. THE GRAB with nothing in reach: E, sample headX / mood
  out.grab = await Promise.all([
    page.evaluate(() => new Promise(res => {
      const g = window.__capy; const rows = []; const t0 = performance.now()
      const tick = () => {
        const a = g.capy.animAudit(); const t = (performance.now() - t0) / 1000
        rows.push({ t: +t.toFixed(3), headX: +a.headX.toFixed(2), mood: +a.mood.toFixed(2), y: +a.modelY.toFixed(3), pitch: +a.pitch.toFixed(3) })
        if (t < 1.2) requestAnimationFrame(tick); else res(rows)
      }
      tick()
    })),
    (async () => { await page.waitForTimeout(150); await page.keyboard.press('KeyE') })()
  ]).then(r => r[0])
  // 5. THE WORLD: what moves when the animal does not. Diff two frames 1 s apart, HUD excluded.
  out.world = await page.evaluate(async () => {
    const g = window.__capy; const c = g.renderer.domElement
    const grab = () => { g.post.render(); return c.toDataURL('image/png') }
    const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height
    const cx = cv.getContext('2d', { willReadFrequently: true })
    async function dec(url) { const im = new Image(); await new Promise(r => { im.onload = r; im.src = url }); cx.drawImage(im, 0, 0); return cx.getImageData(0, 0, cv.width, cv.height).data }
    const u1 = grab(); await new Promise(r => setTimeout(r, 1000)); const u2 = grab()
    const a = await dec(u1), b = await dec(u2)
    const W = cv.width, H = cv.height; let n = 0, moved = 0; const cells = new Map()
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (x < W * 0.24 && y < H * 0.47) continue; if (x > W * 0.84 && y > H * 0.73) continue
      const i = (y * W + x) * 4
      const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
      n++; if (d > 18) { moved++; const k = Math.floor(x / (W / 8)) + ',' + Math.floor(y / (H / 5)); cells.set(k, (cells.get(k) || 0) + 1) }
    }
    return { biome: g.biome.current, movedPct: +(100 * moved / n).toFixed(2), cells: [...cells.entries()].sort((p, q) => q[1] - p[1]).slice(0, 6) }
  })
  await page.evaluate((o) => fetch('/shot?name=l6r-art-anim.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
