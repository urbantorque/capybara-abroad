// RE-RANK THE WHOLE WALK-THROUGH CANDIDATE LIST THROUGH THE WALL TEST.
//
// X9 built the test (px-x5-norm.js) and then applied it to six points, which
// left area 2 of ROADMAP-PHYSICS.md still counting hillsides as walls. This is
// the debt. Every non-vegetation sample the 4 Sep solid audit recorded - 99
// points over 15 chapters, from qa/audit-2026-09-04/audit-solid.md - gets
// settled and classified.
//
// The audit's instrument was a single chest-height drawn ray with no physics hit
// within 2.5 m. That nominates FOUR different things and calls them all walls:
//   wall     - same distance at ankle, chest and head, normal near-horizontal
//   ground   - the drawn terrain rising ahead; normal near-vertical (|ny| > 0.5)
//   slope    - runs further at head height than at ankle
//   overhang - the underside of something; normal points DOWN (ny < -0.5)
//   gone     - nothing there on three reps, so what it saw had moved
// Only the first is a defect. The others are a hill, a hill, a ceiling and a cat.
async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const byCh = {"quay":[{"id":"1264","cls":"INST?","x":227,"z":-490,"ux":1,"uz":0,"d":2.25},{"id":"1264","cls":"INST?","x":232,"z":-490,"ux":-1,"uz":0,"d":0.96}],"pasto":[{"id":"1591","cls":"STRUCT","x":-23,"z":40,"ux":1,"uz":0,"d":0.72},{"id":"1591","cls":"STRUCT","x":20,"z":40,"ux":1,"uz":0,"d":2.39},{"id":"1591","cls":"STRUCT","x":25,"z":40,"ux":-1,"uz":0,"d":2.39}],"kyoto":[{"id":"2056","cls":"INST?","x":-100,"z":-40,"ux":1,"uz":0,"d":1.11},{"id":"2056","cls":"INST?","x":-95,"z":-40,"ux":0,"uz":1,"d":0.71},{"id":"2056","cls":"INST?","x":-95,"z":-30,"ux":1,"uz":0,"d":1.59},{"id":"2046","cls":"INST?","x":-27,"z":-55,"ux":0,"uz":1,"d":2.47},{"id":"2046","cls":"INST?","x":-27,"z":-25,"ux":1,"uz":0,"d":1.16},{"id":"2046","cls":"INST?","x":-20,"z":-65,"ux":0,"uz":1,"d":2.11},{"id":"2040","cls":"INST?","x":-100,"z":85,"ux":-1,"uz":0,"d":0.06},{"id":"2040","cls":"INST?","x":-75,"z":10,"ux":-1,"uz":0,"d":1.04},{"id":"2040","cls":"INST?","x":33,"z":-55,"ux":0,"uz":1,"d":1.65},{"id":"2009","cls":"STRUCT","x":-37,"z":20,"ux":0,"uz":-1,"d":1.25},{"id":"2009","cls":"STRUCT","x":-32,"z":20,"ux":0,"uz":-1,"d":1.25},{"id":"2026","cls":"STRUCT","x":12,"z":180,"ux":1,"uz":0,"d":0.08},{"id":"2026","cls":"STRUCT","x":43,"z":180,"ux":1,"uz":0,"d":0.81},{"id":"2015","cls":"STRUCT","x":-15,"z":20,"ux":0,"uz":1,"d":1.1},{"id":"2043","cls":"STRUCT","x":-10,"z":25,"ux":1,"uz":0,"d":2.01}],"cali":[{"id":"2437","cls":"INST?","x":62,"z":-30,"ux":0,"uz":1,"d":2.03},{"id":"2437","cls":"INST?","x":67,"z":-30,"ux":1,"uz":0,"d":1.27},{"id":"2437","cls":"INST?","x":72,"z":-35,"ux":0,"uz":-1,"d":1.35},{"id":"2441","cls":"INST?","x":-61,"z":-20,"ux":-1,"uz":0,"d":0.03},{"id":"2441","cls":"INST?","x":-51,"z":-30,"ux":1,"uz":0,"d":1.42},{"id":"2441","cls":"INST?","x":-42,"z":70,"ux":-1,"uz":0,"d":0.91},{"id":"2395","cls":"STRUCT","x":-12,"z":-5,"ux":1,"uz":0,"d":1.37},{"id":"2395","cls":"STRUCT","x":-12,"z":5,"ux":1,"uz":0,"d":1.37},{"id":"2395","cls":"STRUCT","x":77,"z":15,"ux":0,"uz":-1,"d":0.75},{"id":"2406","cls":"INST?","x":-61,"z":20,"ux":0,"uz":1,"d":1.06},{"id":"2406","cls":"INST?","x":72,"z":20,"ux":0,"uz":1,"d":0.98},{"id":"2402","cls":"STRUCT","x":52,"z":60,"ux":1,"uz":0,"d":1.93},{"id":"2430","cls":"STRUCT","x":-17,"z":40,"ux":-1,"uz":0,"d":0.13}],"rio":[{"id":"2720","cls":"INST?","x":-90,"z":10,"ux":0,"uz":-1,"d":1.18},{"id":"2720","cls":"INST?","x":92,"z":5,"ux":-1,"uz":0,"d":1.63},{"id":"2700","cls":"STRUCT","x":-52,"z":-30,"ux":0,"uz":-1,"d":1.18},{"id":"2702","cls":"STRUCT","x":73,"z":-35,"ux":-1,"uz":0,"d":2.18},{"id":"2707","cls":"STRUCT","x":35,"z":80,"ux":0,"uz":-1,"d":0.93}],"sahara":[{"id":"3442","cls":"STRUCT","x":258,"z":55,"ux":0,"uz":1,"d":2.07},{"id":"3442","cls":"STRUCT","x":263,"z":55,"ux":0,"uz":1,"d":1.69},{"id":"3442","cls":"STRUCT","x":273,"z":-35,"ux":0,"uz":-1,"d":1.84},{"id":"3292","cls":"STRUCT","x":-65,"z":35,"ux":0,"uz":-1,"d":0.08},{"id":"3292","cls":"STRUCT","x":-60,"z":25,"ux":-1,"uz":0,"d":1.87},{"id":"3292","cls":"STRUCT","x":-55,"z":40,"ux":0,"uz":1,"d":0.14},{"id":"3278","cls":"STRUCT","x":-2,"z":20,"ux":-1,"uz":0,"d":0.98},{"id":"3278","cls":"STRUCT","x":8,"z":20,"ux":-1,"uz":0,"d":1.19},{"id":"3414","cls":"INST?","x":258,"z":-80,"ux":1,"uz":0,"d":1.46},{"id":"3424","cls":"INST?","x":312,"z":-80,"ux":1,"uz":0,"d":0.7}],"drift":[{"id":"3744","cls":"STRUCT","x":-110,"z":40,"ux":0,"uz":-1,"d":1.28},{"id":"3744","cls":"STRUCT","x":-110,"z":45,"ux":0,"uz":-1,"d":1.24},{"id":"3744","cls":"STRUCT","x":35,"z":-140,"ux":1,"uz":0,"d":1.21},{"id":"3737","cls":"INST?","x":-48,"z":-110,"ux":-1,"uz":0,"d":0.96},{"id":"3737","cls":"INST?","x":-38,"z":-120,"ux":1,"uz":0,"d":1.78},{"id":"3737","cls":"INST?","x":-38,"z":-115,"ux":1,"uz":0,"d":0.91},{"id":"3733","cls":"INST?","x":-68,"z":-150,"ux":-1,"uz":0,"d":1.92},{"id":"3733","cls":"INST?","x":-38,"z":-105,"ux":1,"uz":0,"d":1.31},{"id":"3733","cls":"INST?","x":-27,"z":-115,"ux":0,"uz":-1,"d":1.75},{"id":"3738","cls":"INST?","x":-38,"z":-110,"ux":1,"uz":0,"d":0.94},{"id":"3738","cls":"INST?","x":-37,"z":-125,"ux":0,"uz":1,"d":2.28},{"id":"3738","cls":"INST?","x":5,"z":30,"ux":1,"uz":0,"d":0.15},{"id":"3739","cls":"INST?","x":-73,"z":-150,"ux":1,"uz":0,"d":1.54},{"id":"3739","cls":"INST?","x":-37,"z":-110,"ux":-1,"uz":0,"d":1.64},{"id":"3739","cls":"INST?","x":-12,"z":25,"ux":-1,"uz":0,"d":1.96},{"id":"3740","cls":"INST?","x":-63,"z":-85,"ux":1,"uz":0,"d":2.39},{"id":"3740","cls":"INST?","x":-32,"z":-120,"ux":0,"uz":1,"d":1.77},{"id":"3725","cls":"STRUCT","x":-2,"z":30,"ux":1,"uz":0,"d":1.08}],"venice":[{"id":"4024","cls":"STRUCT","x":-77,"z":-55,"ux":0,"uz":1,"d":1.45},{"id":"4024","cls":"STRUCT","x":-77,"z":-50,"ux":0,"uz":-1,"d":2},{"id":"4024","cls":"STRUCT","x":-77,"z":-20,"ux":0,"uz":1,"d":1.72},{"id":"4026","cls":"STRUCT","x":-130,"z":-65,"ux":-1,"uz":0,"d":0.17},{"id":"4026","cls":"STRUCT","x":-93,"z":-5,"ux":0,"uz":1,"d":0.54}],"kowloon":[{"id":"4337","cls":"STRUCT","x":-5,"z":-65,"ux":1,"uz":0,"d":0.77},{"id":"4337","cls":"STRUCT","x":5,"z":-65,"ux":-1,"uz":0,"d":0.77}],"palawan":[{"id":"4627","cls":"STRUCT","x":-48,"z":40,"ux":0,"uz":-1,"d":0.34},{"id":"4627","cls":"STRUCT","x":-43,"z":55,"ux":-1,"uz":0,"d":1.29},{"id":"4627","cls":"STRUCT","x":-38,"z":60,"ux":0,"uz":1,"d":0.26}],"goreme":[{"id":"5035","cls":"STRUCT","x":-8,"z":10,"ux":1,"uz":0,"d":1.6},{"id":"5035","cls":"STRUCT","x":-3,"z":10,"ux":0,"uz":1,"d":1.54},{"id":"5035","cls":"STRUCT","x":-3,"z":15,"ux":1,"uz":0,"d":1.33},{"id":"4888","cls":"STRUCT","x":-37,"z":20,"ux":1,"uz":0,"d":2.05},{"id":"4888","cls":"STRUCT","x":-27,"z":0,"ux":0,"uz":-1,"d":1.23},{"id":"4888","cls":"STRUCT","x":-3,"z":0,"ux":1,"uz":0,"d":1.51},{"id":"4890","cls":"STRUCT","x":-23,"z":70,"ux":0,"uz":-1,"d":2.08},{"id":"4890","cls":"STRUCT","x":-8,"z":55,"ux":-1,"uz":0,"d":2.42},{"id":"4890","cls":"STRUCT","x":-3,"z":40,"ux":-1,"uz":0,"d":0.67},{"id":"5007","cls":"INST?","x":82,"z":-65,"ux":-1,"uz":0,"d":0.1},{"id":"5007","cls":"INST?","x":82,"z":-60,"ux":0,"uz":-1,"d":0.14},{"id":"4998","cls":"INST?","x":82,"z":-80,"ux":0,"uz":-1,"d":1.78},{"id":"5026","cls":"INST?","x":68,"z":5,"ux":0,"uz":1,"d":0.78}],"pantanal":[{"id":"1206","cls":"STRUCT","x":-47,"z":-120,"ux":0,"uz":-1,"d":1.7},{"id":"1206","cls":"STRUCT","x":-43,"z":-120,"ux":0,"uz":-1,"d":2.11},{"id":"1206","cls":"STRUCT","x":-18,"z":-125,"ux":0,"uz":-1,"d":0.46},{"id":"5600","cls":"STRUCT","x":92,"z":-110,"ux":0,"uz":1,"d":0.43}],"cave":[{"id":"5815","cls":"STRUCT","x":-75,"z":-155,"ux":0,"uz":-1,"d":0.9},{"id":"5827","cls":"STRUCT","x":-17,"z":-200,"ux":1,"uz":0,"d":0.67}],"antarctic":[{"id":"6112","cls":"INST?","x":-172,"z":-440,"ux":1,"uz":0,"d":1.59},{"id":"6112","cls":"INST?","x":-162,"z":-440,"ux":-1,"uz":0,"d":1.1},{"id":"6074","cls":"STRUCT","x":-187,"z":-235,"ux":0,"uz":1,"d":2.33}],"monaco":[{"id":"1206","cls":"STRUCT","x":-135,"z":65,"ux":-1,"uz":0,"d":0.17}]}

  const RUN = (list) => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON, b = g.capy.body
    const nm = g.biome.current, inp = g.input
    const T = k => { for (let i = 0; i < k; i++) { inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0; inp.jump = false; inp.jumpPressed = false; g.tick(1 / 60, false) } }
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
    const WATER = /water|sea\b|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    const N = new THREE.Matrix3(), NV = new THREE.Vector3()
    const F = new CANNON.Vec3(), Tv = new CANNON.Vec3()

    const shoot = (P, dy, ux, uz) => {
      const ray = new THREE.Raycaster(); ray.far = 4.0
      ray.set(new THREE.Vector3(P.x, P.y + dy, P.z), new THREE.Vector3(ux, 0, uz).normalize())
      const roots = g.scene.children.filter(c => c.visible && c !== g.capy.group)
      for (const h of ray.intersectObjects(roots, true)) {
        let o = h.object, ok = true
        while (o) { if (!o.visible || (o.name && WATER.test(o.name))) { ok = false; break } o = o.parent }
        if (!ok) continue
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material
        if (m && m.transparent && m.opacity < 0.6) continue
        let ny = null
        if (h.face) { N.getNormalMatrix(h.object.matrixWorld); NV.copy(h.face.normal).applyMatrix3(N).normalize(); ny = +NV.y.toFixed(2) }
        return { d: +h.distance.toFixed(2), ny }
      }
      return null
    }
    const physD = (P, ux, uz) => {
      F.set(P.x, P.y, P.z); Tv.set(P.x + ux * 4, P.y, P.z + uz * 4)
      let best = null
      try {
        g.world.raycastAll(F, Tv, {}, (res) => {
          if (!res.hasHit || !res.body || res.body === b || res.body.mass > 0 || res.body.isTrigger) return
          if (res.body.userData && (res.body.userData.npc || res.body.userData.local)) return
          const st = res.shape && res.shape.type
          if (st === CANNON.Shape.types.HEIGHTFIELD || st === CANNON.Shape.types.PLANE) return
          if (best === null || res.distance < best) best = res.distance
        })
      } catch (e) { return null }
      return best === null ? null : +best.toFixed(2)
    }

    const rows = []
    for (const s of list) {
      const t = th(s.x, s.z)
      b.position.set(s.x, Math.max(t, 0) + 3.0, s.z)
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      let st = 0
      for (let i = 0; i < 180; i++) { T(1); if (Math.abs(b.velocity.y) < 0.05) { if (++st > 12) break } else st = 0 }
      const P = { x: b.position.x, y: b.position.y, z: b.position.z }
      // three reps of the chest ray: a face that moves is a person or an animal
      const c0 = shoot(P, 0, s.ux, s.uz); T(25)
      b.position.set(P.x, P.y, P.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      const c1 = shoot(P, 0, s.ux, s.uz)
      const ankle = shoot(P, -0.20, s.ux, s.uz), head = shoot(P, 1.00, s.ux, s.uz)
      const phys = physD(P, s.ux, s.uz)

      let verdict
      if (!c0 && !c1) verdict = 'gone'
      else if (!c0 || !c1 || Math.abs(c0.d - c1.d) > 0.5) verdict = 'moving'
      else if (c0.ny !== null && c0.ny < -0.5) verdict = 'overhang'
      else if (c0.ny !== null && c0.ny > 0.5) verdict = 'ground'
      else if (head && head.d > c0.d + 0.6) verdict = 'slope'
      else if (!head) verdict = 'low'                    // nothing at head height
      else verdict = 'WALL'
      if (verdict === 'WALL' && phys !== null && phys < c0.d + 0.6) verdict = 'solid already'

      rows.push({ nm, id: s.id, at: [s.x, s.z], dir: [s.ux, s.uz], auditD: s.d,
                  y: +P.y.toFixed(2), onBuilt: +(P.y - 0.34 - t).toFixed(2),
                  ankle, chest: c0, chest2: c1, head, phys, verdict })
    }
    return rows
  }

  for (const ch of Object.keys(byCh)) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (!g.biome.isActive(nm)) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(3600)
      const seen = await page.evaluate(() => window.__capy.biome.current)
      if (seen !== ch) { out.errs.push('BIOME MISMATCH asked ' + ch + ' got ' + seen); continue }
      out.rows = out.rows.concat(await page.evaluate(RUN, byCh[ch]))
    } catch (e) { out.errs.push(ch + ': ' + String(e).slice(0, 160)) }
  }
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null)
  await page.evaluate(o => fetch('/shot?name=px-x5-rerank.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
