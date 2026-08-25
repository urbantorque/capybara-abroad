async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const probe = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const k = g.kyoto
    const out = { pts: [] }
    // snap a chain of points along the river from the bridge to the mill
    let p = k.aheadOnRiver(4, 128, 0)
    let cur = { x: p.x, z: p.z }
    for (let i = 0; i < 14; i++) {
      const f = k.flow(cur.x, cur.z)
      out.pts.push({ i, x: +cur.x.toFixed(1), z: +cur.z.toFixed(1),
        wh: +k.waterHeightAt(cur.x, cur.z).toFixed(2),
        th: +k.terrainHeight(cur.x, cur.z).toFixed(2),
        ow: k.isOverWater(cur.x, cur.z) ? 1 : 0,
        sp: +f.speed.toFixed(2), fx: +f.x.toFixed(2), fz: +f.z.toFixed(2) })
      const nx = k.aheadOnRiver(cur.x, cur.z, 18)
      cur = { x: nx.x, z: nx.z }
    }
    out.runLength = k.runLength(); out.riverLength = k.riverLength()
    return out
  })
  await page.evaluate((o) => fetch('/shot?name=p3k4a.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), probe)

  await page.evaluate(() => {
    const g = window.__capy
    window.__log = { sfx: [], toast: [], lift: [], task: [], trace: [] }
    const s0 = g.sfx.bind(g)
    g.sfx = function (n, o) { window.__log.sfx.push({ n, v: o && o.volume }); return s0(n, o) }
    const t0 = g.toast.bind(g)
    g.toast = function (t) { window.__log.toast.push(String(t)); return t0(t) }
    if (g.music && g.music.lift) { const l0 = g.music.lift.bind(g.music); g.music.lift = function (a) { window.__log.lift.push(a); return l0(a) } }
    g.events.on('task:complete', e => window.__log.task.push(e && e.id))
    // start ON the centreline, floating at the surface
    const k = g.kyoto, b = g.capy.body
    const p = k.aheadOnRiver(4, 128, 4)
    const y = k.waterHeightAt(p.x, p.z) + 0.05
    b.position.set(p.x, y, p.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    window.__t0 = performance.now()
    window.__tr = setInterval(() => {
      const c = g.capy
      window.__log.trace.push({ t: +((performance.now() - window.__t0) / 1000).toFixed(1),
        x: +c.position.x.toFixed(1), z: +c.position.z.toFixed(1), y: +c.position.y.toFixed(2),
        sw: !!c.swimming, wet: +(c.wet || 0).toFixed(2), inR: k.inRiver(), rt: +k.runTime().toFixed(1) })
    }, 1000)
  })
  let done = false
  for (let i = 0; i < 150 && !done; i++) {
    await page.waitForTimeout(500)
    done = await page.evaluate(() => !!window.__capy.taskDone('uji-run'))
  }
  await page.screenshot({ path: 'qa/p3k-uji-moment.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto, THREE = g.THREE
    clearInterval(window.__tr)
    const r = { done: !!g.taskDone('uji-run'), log: window.__log }
    const p = g.capy.position
    r.capy = { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) }
    r.distToMill = +Math.hypot(p.x - k.mill.x, p.z - k.mill.z).toFixed(1)
    const cam = g.camera; cam.updateMatrixWorld()
    const fr = new THREE.Frustum()
    fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse))
    r.millInFrustum = fr.containsPoint(new THREE.Vector3(k.mill.x, 1.5, k.mill.z))
    r.capyInFrustum = fr.containsPoint(new THREE.Vector3(p.x, p.y, p.z))
    r.millNDC = (function () { const v = new THREE.Vector3(k.mill.x, 1.5, k.mill.z).project(cam); return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) } })()
    r.capyNDC = (function () { const v = new THREE.Vector3(p.x, p.y, p.z).project(cam); return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) } })()
    r.cam = { x: +cam.position.x.toFixed(1), y: +cam.position.y.toFixed(1), z: +cam.position.z.toFixed(1) }
    const card = document.querySelector('.capyui-place, #capyui-place')
    r.placeCard = card ? { txt: (card.textContent || '').slice(0, 90), op: getComputedStyle(card).opacity } : null
    r.wowEls = Array.from(document.querySelectorAll('[class*=wow], [class*=moment], [class*=place]')).map(e => (e.className || '') + ':' + (e.textContent || '').slice(0, 50) + ':' + getComputedStyle(e).opacity)
    r.music = { live: g.music.live, playing: g.music.playing }
    r.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return r
  })
  await page.evaluate((o) => fetch('/shot?name=p3k4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}