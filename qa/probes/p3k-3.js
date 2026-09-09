async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    window.__log = { sfx: [], toast: [], lift: [], place: [], task: [] }
    const s0 = g.sfx.bind(g)
    g.sfx = function (n, o) { window.__log.sfx.push({ n, v: o && o.volume, t: +(g.state.time || 0).toFixed(2) }); return s0(n, o) }
    const t0 = g.toast.bind(g)
    g.toast = function (t) { window.__log.toast.push({ t: String(t), at: +(g.state.time || 0).toFixed(2) }); return t0(t) }
    if (g.music && g.music.lift) { const l0 = g.music.lift.bind(g.music); g.music.lift = function (a) { window.__log.lift.push({ a, at: +(g.state.time || 0).toFixed(2) }); return l0(a) } }
    g.events.on('task:complete', e => window.__log.task.push({ id: e && e.id, at: +(g.state.time || 0).toFixed(2) }))
  })
  await page.waitForTimeout(1200)
  // drop the animal into the Uji at the run start, just below the surface
  await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto, b = g.capy.body
    const x = 4, z = 132
    const y = k.waterHeightAt(x, z) - 0.15
    b.position.set(x, y, z); b.velocity.set(0, 0, 3)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    window.__start = { x, y: +y.toFixed(2), z }
  })
  // let the river do it, in real time
  let done = false
  for (let i = 0; i < 130 && !done; i++) {
    await page.waitForTimeout(500)
    done = await page.evaluate(() => !!(window.__capy.taskDone && window.__capy.taskDone('uji-run')))
  }
  // THE MOMENT. screenshot right now.
  await page.screenshot({ path: 'qa/p3k-uji-moment.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy, k = g.kyoto, THREE = g.THREE
    const r = { done: !!g.taskDone('uji-run'), log: window.__log, start: window.__start }
    const p = g.capy.position
    r.capy = { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) }
    r.mill = k.mill
    r.distToMill = +Math.hypot(p.x - k.mill.x, p.z - k.mill.z).toFixed(1)
    // FRAMED: is the mill in the camera frustum?
    const cam = g.camera
    cam.updateMatrixWorld()
    const fr = new THREE.Frustum()
    fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse))
    const mp = new THREE.Vector3(k.mill.x, 1.5, k.mill.z)
    r.millInFrustum = fr.containsPoint(mp)
    const cp = new THREE.Vector3(p.x, p.y, p.z)
    r.capyInFrustum = fr.containsPoint(cp)
    // screen position of the mill
    const sp = mp.clone().project(cam)
    r.millNDC = { x: +sp.x.toFixed(2), y: +sp.y.toFixed(2), z: +sp.z.toFixed(2) }
    const sc = cp.clone().project(cam)
    r.capyNDC = { x: +sc.x.toFixed(2), y: +sc.y.toFixed(2), z: +sc.z.toFixed(2) }
    r.cam = { x: +cam.position.x.toFixed(1), y: +cam.position.y.toFixed(1), z: +cam.position.z.toFixed(1) }
    // LIT: lights in the scene and the sun direction
    const lights = []
    g.scene.traverse(o => { if (o.isLight) lights.push({ t: o.type, i: +o.intensity.toFixed(2), vis: o.visible,
      x: +o.position.x.toFixed(0), y: +o.position.y.toFixed(0), z: +o.position.z.toFixed(0) }) })
    r.lights = lights
    // ACKNOWLEDGED: what is on screen
    const card = document.querySelector('.capyui-place, #capyui-place')
    r.placeCard = card ? { txt: (card.textContent || '').slice(0, 90), vis: getComputedStyle(card).opacity } : null
    const toastEl = document.querySelector('.capyui-toast, #capyui-toast')
    r.toastEl = toastEl ? { txt: (toastEl.textContent || '').slice(0, 90), op: getComputedStyle(toastEl).opacity } : null
    r.todo = Array.from(document.querySelectorAll('#capyui-todo li, .capyui-todo li')).map(l => l.textContent.slice(0, 60))
    r.music = { live: g.music.live, playing: g.music.playing }
    r.records = g.records ? g.records : null
    r.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return r
  })
  await page.evaluate((o) => fetch('/shot?name=p3k3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}