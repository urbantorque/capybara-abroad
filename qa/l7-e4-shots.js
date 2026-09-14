async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, rows: [], scene: {} }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const info = async (tag) => page.evaluate((tag) => {
    const g = window.__capy, T = g.THREE
    const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd)
    const pitch = Math.asin(-fwd.y)
    const hz = 0.5 - Math.tan(pitch) / Math.tan(g.camera.fov * Math.PI / 360) * 0.5
    const box = new T.Box3().setFromObject(g.capy.group)
    const pts = [], W = g.renderer.domElement.width, H = g.renderer.domElement.height
    for (let i = 0; i < 8; i++) {
      const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
      p.project(g.camera); pts.push(p)
    }
    const ys = pts.map(p => (1 - p.y) * 0.5 * H), xs = pts.map(p => (p.x + 1) * 0.5 * W)
    const capyPx = { h: +(Math.max(...ys) - Math.min(...ys)).toFixed(0), w: +(Math.max(...xs) - Math.min(...xs)).toFixed(0), cx: +((Math.max(...xs) + Math.min(...xs)) / 2 / W).toFixed(3), cy: +((Math.max(...ys) + Math.min(...ys)) / 2 / H).toFixed(3) }
    const ci = g.camInfo || {}
    return { tag, biome: g.biome.current, camPitch: +(pitch * 180 / Math.PI).toFixed(1), horizonFromTop: +hz.toFixed(2),
      dist: +(ci.dist || 0).toFixed(1), rest: ci.rest, capyPx, cam: g.camera.position.toArray().map(v => +v.toFixed(2)),
      key: g.capy.keyInfo ? g.capy.keyInfo() : null, lastError: g.state.lastError || null }
  }, tag)
  const audit = async () => page.evaluate(() => {
    const g = window.__capy
    const live = g.biome.current
    const L = (g.locals || []).filter(r => r.biome === live && r.fig && r.group)
    const st = L.map(r => ({ aLx: +r.fig.armL.rotation.x.toFixed(2), aLz: +r.fig.armL.rotation.z.toFixed(2), aRx: +r.fig.armR.rotation.x.toFixed(2), aRz: +r.fig.armR.rotation.z.toFixed(2),
      eL: +r.fig.elbowL.rotation.x.toFixed(2), eR: +r.fig.elbowR.rotation.x.toFixed(2), kL: +r.fig.kneeL.rotation.x.toFixed(2), kR: +r.fig.kneeR.rotation.x.toFixed(2),
      tx: +r.fig.torso.rotation.x.toFixed(3), tz: +r.fig.torso.rotation.z.toFixed(3), px: +r.fig.torso.position.x.toFixed(3),
      mv: +(r.mv || 0).toFixed(2), stW: +(r.stW || 0).toFixed(2), st: r.fig.stance ? r.fig.stance.n : null }))
    const sd = k => { const a = st.map(s => s[k]); const m = a.reduce((p, q) => p + q, 0) / Math.max(1, a.length); return +Math.sqrt(a.reduce((p, q) => p + (q - m) * (q - m), 0) / Math.max(1, a.length)).toFixed(3) }
    const keys = ['aLx', 'aLz', 'aRx', 'aRz', 'eL', 'eR', 'kL', 'kR', 'tx', 'tz', 'px']
    const spread = {}; for (const k of keys) spread[k] = sd(k)
    const names = {}; for (const s of st) names[s.st] = (names[s.st] || 0) + 1
    return { live, localsN: L.length, spread, names, sample: st.slice(0, 12), err: g.state.lastError || null }
  })
  const CH = ['cave', 'venice', 'quay', 'sahara', 'kowloon']
  for (const c of CH) {
    await page.evaluate((c) => window.__capy.hud.cross(c), c)
    await page.waitForTimeout(9000)
    await page.screenshot({ path: 'qa/l7-e4-' + c + '-arrive.png' })
    out.rows.push(await info('arrive'))
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3200)
    await page.screenshot({ path: 'qa/l7-e4-' + c + '-walk.png' })
    out.rows.push(await info('walk'))
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    await page.screenshot({ path: 'qa/l7-e4-' + c + '-rest.png' })
    out.rows.push(await info('rest'))
    out.scene[c] = await audit()
  }
  await page.evaluate((o) => fetch('/shot?name=l7-e4-shots.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
