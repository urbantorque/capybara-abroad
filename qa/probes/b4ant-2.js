async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(1800)
  await page.evaluate(() => {
    const g = window.__capy
    window.__rec = []; window.__toast = []; window.__sfx = []; window.__cam = []
    const rawR = g.record.bind(g)
    g.record = function (id, v) { window.__rec.push([id, +(+v).toFixed(2)]); return rawR(id, v) }
    const rawT = g.toast.bind(g)
    g.toast = function (t) { window.__toast.push(String(t).slice(0, 60)); return rawT(t) }
    const rawS = g.sfx.bind(g)
    g.sfx = function (n, o) {
      if (o && o.volume >= 0.45) {
        const c = g.camera, p = g.capy.position
        window.__sfx.push({ n, v: +o.volume.toFixed(2), at: !!o.at,
          t: +g.state.time.toFixed(2),
          cam: [+c.position.x.toFixed(1), +c.position.y.toFixed(2), +c.position.z.toFixed(1)],
          capy: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)] })
      }
      return rawS(n, o)
    }
    const h = g.antarctic.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('e')
  await page.waitForTimeout(500)

  const steerTo = async (t, seconds) => {
    await page.keyboard.down('w')
    const end = Date.now() + seconds * 1000
    while (Date.now() < end) {
      const st = await page.evaluate((tt) => {
        const a = window.__capy.antarctic
        const bx = a.boat.position.x, bz = a.boat.position.z
        const want = Math.atan2(tt[0] - bx, tt[1] - bz)
        let e = want - a.boat.heading
        while (e > Math.PI) e -= Math.PI * 2
        while (e < -Math.PI) e += Math.PI * 2
        return { e, d: Math.hypot(tt[0] - bx, tt[1] - bz) }
      }, t)
      if (st.d < 30) break
      const key = st.e > 0.10 ? 'a' : st.e < -0.10 ? 'd' : null
      if (key) {
        const hold = Math.min(400, Math.max(70, Math.abs(st.e) * 260))
        await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key)
      } else { await page.waitForTimeout(200) }
    }
    await page.keyboard.up('w')
  }

  const target = await page.evaluate(() => { const q = window.__capy.antarctic.pod(); return [q.x, q.z + 120] })
  await steerTo(target, 75)

  // sample every orca's NDC, plus whether it is over a floe
  await page.evaluate(() => {
    const g = window.__capy
    const mul4 = (e, v) => [
      e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12] * v[3],
      e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13] * v[3],
      e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14] * v[3],
      e[3] * v[0] + e[7] * v[1] + e[11] * v[2] + e[15] * v[3]]
    window.__ndc = (c, x, y, z) => {
      const a = mul4(c.matrixWorldInverse.elements, [x, y, z, 1])
      const p = mul4(c.projectionMatrix.elements, a)
      const w = p[3] === 0 ? 1e-6 : p[3]
      return [p[0] / w, p[1] / w, p[2] / w]
    }
    window.__iv = setInterval(() => {
      const a = g.antarctic, c = g.camera, p = g.capy.position
      let pod = null
      const root = g.scene.getObjectByName('antarctic')
      if (root) {
        root.traverse(o => {
          if (pod) return
          if (o.type === 'Group' && o.children.length === 6 &&
              o.children.every(ch => ch.type === 'Group')) pod = o.children
        })
      }
      const proj = pod ? pod.map(ch => {
        const n = window.__ndc(c, ch.position.x, ch.position.y, ch.position.z)
        return [+n[0].toFixed(2), +n[1].toFixed(2), +n[2].toFixed(3), +ch.position.y.toFixed(2)]
      }) : null
      const dx = c.position.x - p.x, dz = c.position.z - p.z, dh = Math.hypot(dx, dz)
      window.__cam.push({ t: +g.state.time.toFixed(2), sp: +a.boat.speed.toFixed(2),
        wp: +a.withPod().toFixed(2),
        yaw: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1), dist: +dh.toFixed(2),
        pitch: +(Math.atan2(c.position.y - p.y, dh) * 180 / Math.PI).toFixed(1),
        raise: +(c.position.y - p.y).toFixed(2),
        hdg: +(a.boat.heading * 180 / Math.PI).toFixed(1),
        fov: g.camera.fov, ride: g.hud.isTaskDone('orca-ride'), proj })
      if (window.__cam.length > 700) clearInterval(window.__iv)
    }, 60)
  })

  await page.keyboard.press('q')
  await page.waitForTimeout(600)
  await page.keyboard.down('w')
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(700)
    const e = await page.evaluate(() => {
      const a = window.__capy.antarctic
      let e2 = Math.PI - a.boat.heading
      while (e2 > Math.PI) e2 -= Math.PI * 2
      while (e2 < -Math.PI) e2 += Math.PI * 2
      return e2
    })
    const key = e > 0.12 ? 'a' : e < -0.12 ? 'd' : null
    if (key) { await page.keyboard.down(key); await page.waitForTimeout(130); await page.keyboard.up(key) }
  }
  await page.keyboard.up('w')
  await page.evaluate(() => { clearInterval(window.__iv) })

  const out = await page.evaluate(() => {
    const g = window.__capy
    const s = window.__cam
    const ri = s.findIndex(k => k.ride)
    // the breach apex is the loudest splash (volume 0.7)
    const breach = window.__sfx.filter(k => k.n === 'splash' && k.v >= 0.6)
    const highest = s.reduce((b, k) => {
      if (!k.proj) return b
      const m = Math.max(...k.proj.map(q => q[3]))
      return (!b || m > b.m) ? { m: +m.toFixed(2), t: k.t, proj: k.proj, yaw: k.yaw, dist: k.dist, pitch: k.pitch, fov: k.fov } : b
    }, null)
    return {
      ride: g.hud.isTaskDone('orca-ride'), err: g.state.lastError || null,
      nSamples: s.length, podFound: !!(s[0] && s[0].proj),
      recCalls: window.__rec.length,
      recOrca: window.__rec.filter(r => r[0] === 'orca-ride').length,
      recFirst5: window.__rec.filter(r => r[0] === 'orca-ride').slice(0, 5),
      toasts: window.__toast.length,
      toastPB: window.__toast.filter(t => t.indexOf('personal best') === 0).length,
      toastList: window.__toast.slice(-10),
      loudSfx: window.__sfx.map(k => [k.n, k.v, k.at]),
      breachApex: breach,
      atRide: ri >= 0 ? s[ri] : null,
      breachFrames: highest,
      camMedian: { yaw: s.map(k => k.yaw).sort((a, b) => a - b)[Math.floor(s.length / 2)],
                   dist: s.map(k => k.dist).sort((a, b) => a - b)[Math.floor(s.length / 2)],
                   pitch: s.map(k => k.pitch).sort((a, b) => a - b)[Math.floor(s.length / 2)],
                   raise: s.map(k => k.raise).sort((a, b) => a - b)[Math.floor(s.length / 2)] },
    }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4ant-2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
