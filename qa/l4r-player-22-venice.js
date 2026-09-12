async page => {
  const out = {}
  const snap = async (name) => {
    await page.screenshot({ path: 'qa/' + name + '.png' })
    out[name] = await page.evaluate(() => {
      const g = window.__capy; const p = g.capy.body.position
      const v = new g.THREE.Vector3(p.x, p.y, p.z).project(g.camera)
      return { t: +g.state.time.toFixed(1), pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(1), text: document.body.innerText.split('\n').map(s => s.trim()).filter(l => l && !(window.__pl && window.__pl.base.has(l)) && !/DONE|way on|grab it|Knock over a bin/.test(l)).slice(0, 40) }
    })
  }
  const drain = () => page.evaluate(() => { const s = (window.__pl || {}).seen || {}; const o = {}; for (const k in s) o[k] = [s[k].first, s[k].n]; return o })
  const post = (name, o) => page.evaluate(({ name, o }) => fetch('/shot?name=' + name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { name, o })
  // follow the arrow: steer with real keys toward the task's pointer, like a player reading the arrow
  const follow = async (id, secs, tag, reach, barge) => {
    const held = new Set()
    const setKeys = async (want) => {
      for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k) }
      for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k) }
    }
    const t0 = Date.now(); let n = 0; let arrived = false; let log = []; let stuck = 0; let lastD = 1e9
    while (Date.now() - t0 < secs * 1000) {
      const s = await page.evaluate((id) => {
        const g = window.__capy; const h = Array.isArray(id) ? { x: id[0], z: id[1] } : g.hintTarget(id); if (!h) return null
        const hp = h.position || h.pos || h
        const p = g.capy.body.position
        const dx = hp.x - p.x, dz = hp.z - p.z
        const d = Math.hypot(dx, dz)
        // camera forward on the ground
        const cd = new g.THREE.Vector3(); g.camera.getWorldDirection(cd); cd.y = 0; cd.normalize()
        const rx = -cd.z, rz = cd.x // camera right
        const f = (dx * cd.x + dz * cd.z) / (d || 1), r = (dx * rx + dz * rz) / (d || 1)
        return { d: +d.toFixed(1), f: +f.toFixed(2), r: +r.toFixed(2), done: Array.isArray(id) ? false : g.taskDone(id), hp: [+hp.x.toFixed(1), +hp.z.toFixed(1)] }
      }, id)
      if (!s) { log.push('no target'); break }
      if (s.done) { arrived = true; log.push('done at ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'); break }
      const want = new Set()
      if (s.d > reach) {
        if (s.f > 0.3) want.add('KeyW'); else if (s.f < -0.6) want.add('KeyS')
        if (s.r > 0.25) want.add('KeyD'); else if (s.r < -0.25) want.add('KeyA')
        if (s.d > 6 || barge) want.add('ShiftLeft')
      } else {
        await setKeys(new Set())
        await page.waitForTimeout(400)
        if (!arrived) { arrived = true; log.push('reached at ' + ((Date.now() - t0) / 1000).toFixed(1) + 's d=' + s.d) }; if (Array.isArray(id)) break
      }
      await setKeys(want)
      if (n % 20 === 0) log.push(s); if (Math.abs(lastD - s.d) < 0.15 && s.d > reach) stuck++; else stuck = 0; lastD = s.d; if (stuck > 8) { stuck = 0; log.push('stuck at d=' + s.d + ' -> hop+sidestep'); await page.keyboard.press('Space'); await page.waitForTimeout(300); await setKeys(new Set(['KeyD'])); await page.waitForTimeout(900); await setKeys(new Set(['KeyW', 'ShiftLeft'])); await page.waitForTimeout(700) }
      if (n % 24 === 12) await snap(tag + '-' + Math.floor(n / 24))
      n++
      await page.waitForTimeout(220)
    }
    await setKeys(new Set())
    out[String(id)] = log
  }
  await follow('spritz-theft', 45, 'l4r-player-venice-sp', 1.4, false)
  await page.waitForTimeout(1500); await snap('l4r-player-venice-sp-end')
  await follow('gondola-ride', 60, 'l4r-player-venice-go', 2.0, false)
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(4000); await snap('l4r-player-venice-go-wait-' + i) }
  out.lines = await drain()
  await post('l4r-player-22.json', out)
}
