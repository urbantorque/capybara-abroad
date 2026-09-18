async page => {
  // ROADMAP-WOW Part C, W0 — THE MODEL SHEET. Own camera, raw scene render (no
  // composite), extending qa/art-review.js's own pattern to all nineteen
  // chapters. Review only: this script builds nothing and changes no save
  // state that outlives the page.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  const out = { shots: [], errs, chapters: {} }

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__art = {
      cam(px, py, pz, tx, ty, tz, fov) {
        const c = new T.PerspectiveCamera(fov || 34, 1280 / 760, 0.05, 400)
        c.position.set(px, py, pz); c.lookAt(tx, ty, tz); c.updateMatrixWorld()
        return c
      },
      render(c) {
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        return g.renderer.domElement.toDataURL('image/png')
      },
      // ---- THE HERO POINT — a raycast along the LIVE resting camera's own
      // forward axis, so a hero structure's anchor never has to be hand-typed
      // per chapter. Excludes the sky dome (renderOrder -20, THE PICTURE) and
      // the animal's own body (capy3-visibility-metrics: a self-hit is not
      // the hero).
      heroPoint(maxDist) {
        const cam = g.camera
        const p = cam.getWorldPosition(new T.Vector3())
        const d = cam.getWorldDirection(new T.Vector3())
        const self = new Set()
        const capyRoot = g.capy && (g.capy.model || g.capy.group)
        if (capyRoot) capyRoot.traverse(o => self.add(o))
        const rc = new T.Raycaster(p, d, 0.1, maxDist || 250)
        const hits = rc.intersectObjects(g.scene.children, true)
          .filter(h => h.object.visible !== false && h.object.renderOrder !== -20 && !self.has(h.object))
        const dist = hits.length ? hits[0].distance : 25
        return { x: p.x + d.x * dist, y: p.y + d.y * dist, z: p.z + d.z * dist, dist, camPos: [p.x, p.y, p.z], camDir: [d.x, d.y, d.z] }
      },
      // side/close cameras orbit the hero point using the live camera's own
      // height above it, not a guessed altitude.
      heroSide(hp, angRad, distMul, fov) {
        const cam = g.camera
        const p = cam.getWorldPosition(new T.Vector3())
        const dist = Math.max(4, hp.dist * (distMul || 0.55))
        const baseAng = Math.atan2(p.x - hp.x, p.z - hp.z)
        const ang = baseAng + angRad
        const rise = (p.y - hp.y) * (distMul || 0.55)
        return this.render(this.cam(hp.x + Math.sin(ang) * dist, hp.y + rise, hp.z + Math.cos(ang) * dist, hp.x, hp.y, hp.z, fov || 40))
      },
      heroClose(hp, fov) {
        const cam = g.camera
        const p = cam.getWorldPosition(new T.Vector3())
        const dist = Math.max(2.5, Math.min(hp.dist * 0.22, 9))
        const dir = new T.Vector3(hp.x - p.x, hp.y - p.y, hp.z - p.z).normalize()
        return this.render(this.cam(hp.x - dir.x * dist, hp.y - dir.y * dist + 1.0, hp.z - dir.z * dist, hp.x, hp.y + 1.0, hp.z, fov || 30))
      },
      capyShot(yawOff, dist, up, aimY, aimFwd, fov) {
        const p = g.capy.position
        const my = (g.capy.model || g.capy.group).rotation.y
        const fx = Math.sin(my), fz = Math.cos(my)
        const ax = p.x + fx * (aimFwd || 0), az = p.z + fz * (aimFwd || 0), ay = p.y + (aimY || 0)
        const yaw = my + yawOff
        return this.render(this.cam(ax + Math.sin(yaw) * dist, ay + up, az + Math.cos(yaw) * dist, ax, ay, az, fov))
      },
      inst(vcount, count) {
        const res = []
        g.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.attributes.position.count === vcount && (!count || o.count === count) && o.count > 0) res.push(o) })
        return res
      },
      people(mesh) {
        const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
        const rows = []
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m); m.decompose(p, q, s)
          const f = new T.Vector3(0, 0, 1).applyQuaternion(q)
          rows.push({ i, x: p.x, y: p.y, z: p.z, fx: f.x, fz: f.z, sy: s.y })
        }
        return rows
      },
      personShot(r, dist, up, fov, side) {
        const ang = Math.atan2(r.fx, r.fz) + (side || 0)
        const ay = r.y + 1.15 * (r.sy || 1)
        return this.render(this.cam(r.x + Math.sin(ang) * dist, ay + up, r.z + Math.cos(ang) * dist, r.x, ay, r.z, fov))
      },
      loc(l) { return { x: l.x, y: l.y, z: l.z, fx: Math.sin(l.ry), fz: Math.cos(l.ry), sy: 1 } },
      locals(name) {
        const L = (g.locals || []).filter(l => l.biome === name && l.group)
        window.__loc = L.map(l => ({ x: l.group.position.x, y: l.group.position.y, z: l.group.position.z, ry: l.group.rotation.y, id: l.id || '' }))
        return { n: L.length, ids: window.__loc.slice(0, 8).map(l => l.id) }
      },
      // Nearest instanced-roster figure to a world point, for a chapter whose
      // crowd is built from npcMakeGeo rather than g.locals.
      nearestRoster(x, z) {
        const cands = this.inst(72)
        let best = null, bestD = Infinity
        for (const mesh of cands) {
          const rows = this.people(mesh)
          for (const r of rows) {
            const d = (r.x - x) ** 2 + (r.z - z) ** 2
            if (d < bestD) { bestD = d; best = r }
          }
        }
        return best
      },
    }
  })

  const post = async (name, url) => {
    if (!url || url.length < 100) { out.shots.push(name + ':EMPTY'); return }
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url })
    out.shots.push(name)
  }
  const shot = async (name, fn, arg) => {
    try {
      const url = await page.evaluate(fn, arg)
      await post(name, url)
    } catch (e) { errs.push(name + ': ' + String(e.message || e)) }
  }

  // ---- THE ANIMAL, PLAIN, EIGHT AZIMUTHS (the wardrobe pass's own sheet) ----
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2
    await shot('WOW-capy-az' + i, (y) => window.__art.capyShot(y, 3.0, 0.7, 0.25, 0.1), yaw)
  }

  // chapters in CHAPTERS order (1-19); chapter 1 is reached by the title
  // card's own Digit1 press above, the rest by hud.cross() below.
  const NAMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice',
                 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  // live accessor for the marquee mover, per chapter — from this session's own
  // code audit; 'null' where the mover is closure-only and not reachable.
  const MOVER = {
    pasto: () => window.__capy.condor && window.__capy.condor.group && window.__capy.condor.group.position,
    quay: () => window.__capy.quay && window.__capy.quay.boat,
    cali: () => window.__capy.cali && window.__capy.cali.chivaDebug && window.__capy.cali.chivaDebug(),
    sahara: () => window.__capy.sahara && window.__capy.sahara.caravan && window.__capy.sahara.caravan(),
    kowloon: () => window.__capy.kowloon && window.__capy.kowloon.heli && window.__capy.kowloon.heli(),
    palawan: () => window.__capy.palawan && window.__capy.palawan.manta && window.__capy.palawan.manta(),
    pantanal: () => window.__capy.pantanal && window.__capy.pantanal.herd && window.__capy.pantanal.herd(),
    cave: () => window.__capy.cave && window.__capy.cave.log && window.__capy.cave.log(),
    antarctic: () => window.__capy.antarctic && window.__capy.antarctic.pod && window.__capy.antarctic.pod(),
    monaco: () => window.__capy.monaco && window.__capy.monaco.car && window.__capy.monaco.car(),
    hanoi: () => window.__capy.hanoi && window.__capy.hanoi.cub && window.__capy.hanoi.cub(),
  }
  const COSTUME_TASK = { sydney: 'steal-hat', monaco: 'black-tie', antarctic: 'orca-ride' }

  for (let ci = 0; ci < NAMES.length; ci++) {
    const name = NAMES[ci]
    const rec = { hero: false, side: false, close: false, mover: null, roster: false, locals: null, costume: false }
    out.chapters[name] = rec
    if (ci === 0) {
      // already on sydney from the animal sheet above; re-settle briefly
      await page.waitForTimeout(800)
    } else {
      // trap 36 (headless-qa-harness): digit keys are the TITLE CARD's own
      // picker and do nothing once the game has started; biome.switchTo()
      // swaps geometry but never moves the animal or the camera. hud.cross()
      // is "the only honest arrival" — the real biomeFadeTo journey.
      await page.evaluate((n) => window.__capy.hud.cross(n), name)
      await page.waitForTimeout(9500)
    }

    // ---- hero structure: the live resting camera, raw, plus two orbits ----
    const hp = await page.evaluate(() => window.__art.heroPoint(260))
    rec.heroPoint = hp
    await shot('WOW-' + name + '-hero-arrive', () => window.__art.render(window.__capy.camera))
    await shot('WOW-' + name + '-hero-side', (h) => window.__art.heroSide(h, Math.PI / 2, 0.55, 40), hp)
    await shot('WOW-' + name + '-hero-close', (h) => window.__art.heroClose(h, 30), hp)
    rec.hero = rec.side = rec.close = true

    // ---- marquee mover, if this session found a live accessor for it ----
    if (MOVER[name]) {
      const mp = await page.evaluate(MOVER[name])
      rec.mover = mp || null
      if (mp && typeof mp.x === 'number') {
        await shot('WOW-' + name + '-mover', (m) => {
          const A = window.__art
          return A.render(A.cam(m.x + 4, m.y + 2.4, m.z + 4, m.x, m.y + 0.6, m.z, 36))
        }, mp)
      }
    }

    // ---- NPC kinds: instanced roster near the animal, plus hand-built locals
    const capyPos = await page.evaluate(() => { const p = window.__capy.capy.position; return { x: p.x, z: p.z } })
    await shot('WOW-' + name + '-roster', (cp) => {
      const A = window.__art
      const r = A.nearestRoster(cp.x, cp.z)
      return r ? A.personShot(r, 2.7, 0.35, 34, 0.5) : ''
    }, capyPos)
    const locInfo = await page.evaluate((n) => window.__art.locals(n), name)
    rec.locals = locInfo
    if (locInfo && locInfo.n > 0) {
      await shot('WOW-' + name + '-local', () => {
        const A = window.__art
        const l = (window.__loc || [])[0]
        return l ? A.personShot(A.loc(l), 2.7, 0.35, 34, 0.45) : ''
      })
    }

    // ---- the capybara, in this chapter's costume if this session knows the
    // task id that unlocks it, plain otherwise ----
    if (COSTUME_TASK[name]) {
      await page.evaluate((t) => { window.__capy.completeTask(t, true) }, COSTUME_TASK[name])
      await page.waitForTimeout(1400)
      rec.costume = true
    }
    await shot('WOW-' + name + '-capy', () => window.__art.capyShot(0.7, 2.8, 0.7, 0.28, 0.15))
  }

  await page.evaluate(async (o) => { await fetch('/shot?name=wow-sheet.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
