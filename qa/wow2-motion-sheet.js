async page => {
  // ROADMAP-WOW2 W0 — THE MOTION SHEET. Two subjects at rest, one chapter
  // per invocation (the chapter name is read off qa/wow2-chapter.txt, which
  // the dev server serves: `echo kyoto > qa/wow2-chapter.txt` before the run;
  // window.__wow2Chapter is the fallback).
  //
  //  (a) THE ANIMAL AT REST: a camera pinned 3 m from the animal at its own
  //      eye height, the animal's screen mask by hide-and-diff, then ten
  //      frame pairs 120 ms apart spaced ~1.9 s over ~20 s of real rAF time
  //      (the game loop running, no input). Moved pixels inside the mask,
  //      threshold 8 on any channel, and the mean moved-per-pair / 0.12 =
  //      moved pixels per second.
  //  (b) THE DENSEST CROWD: the living layer — the roster's instanced body
  //      parts (npc.js instMat: vertexColors + PALETTE.sail), the hand-built
  //      locals (game.locals[*].group), and every object or instance that
  //      MOVED between two frames 120 ms apart (traffic, a herd, a ferry, a
  //      chapter's own crowd) — clustered by figure; the cluster of >= 2 with
  //      the most neighbours within 3 m inside 40 m of the animal (tie: the
  //      nearest); a camera 6 m off its centroid on the animal's side; the
  //      living mask by hide-and-diff (wow-still.js's mask INVERTED, which is
  //      what "another notch" number 1 asks for) and the same ten pairs.
  //      The animal is hidden for the whole of (b) so its own life does not
  //      count as the crowd's.
  //  The weather fields (renderOrder 6) are hidden for both subjects: a
  //  shower in front of a face is an event, not the face.
  //  Pictures through the pinned lens go out via the /shot sink as a 2x2
  //  sheet (frame A | frame B / mask | diff of the last pair); page.screenshot
  //  would only ever show the game's own resting lens.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  let chapter = ''
  try { chapter = (await (await page.request.get('http://localhost:5189/qa/wow2-chapter.txt')).text()).trim() } catch (e) {}
  if (!/^[a-z]+$/.test(chapter)) chapter = await page.evaluate(() => window.__wow2Chapter || 'sydney').catch(() => 'sydney')
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state && window.__capy.state.started)).catch(() => false)
  if (!started) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('http://localhost:5189/')
    await page.waitForTimeout(5200)
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} ; document.querySelector('.capyui-go').click() })
    await page.waitForTimeout(3000)
    const ok = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
    if (!ok) errs.push('not started after Begin')
  }
  const live = await page.evaluate(() => window.__capy.biome.current)
  if (live !== chapter) {
    await page.evaluate((n) => window.__capy.hud.cross(n), chapter)
    await page.waitForTimeout(9500)
  }

  // ---- the shared kit, parked on window.__wow2 so that each evaluate stays
  // well under the harness's 20 s ceiling ------------------------------------
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const S0 = window.__wow2
    if (S0 && S0.hidden) for (const o of S0.hidden) o.visible = true   // a crashed run's leftovers
    if (S0 && S0.capyHidden) S0.capyHidden.visible = true
    if (S0 && S0.hidA) for (const o of S0.hidA) o.visible = true
    const S = window.__wow2 = { hidden: [], th: 8 }
    S.W = g.renderer.domElement.width; S.H = g.renderer.domElement.height
    S.c2 = document.createElement('canvas'); S.c2.width = S.W; S.c2.height = S.H
    S.ctx = S.c2.getContext('2d', { willReadFrequently: true })
    S.grab = (cam) => {
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      S.ctx.drawImage(g.renderer.domElement, 0, 0)
      return S.ctx.getImageData(0, 0, S.W, S.H).data
    }
    S.hide = (o) => { if (o && o.visible !== false) { S.hidden.push(o); o.visible = false } }
    S.diffCount = (a, b, mask) => {
      const n = S.W * S.H, th = S.th
      let moved = 0
      for (let i = 0; i < n; i++) {
        if (mask && !mask[i]) continue
        const j = i * 4
        const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
        if (d > th) moved++
      }
      return moved
    }
    S.diffMask = (a, b, not) => {
      // `not`: pixels to leave out — the self-diff of two renders with
      // nothing hidden (a cloud material reads the clock in onBeforeRender,
      // so its soft edge differs between two synchronous renders and was
      // landing in Pasto's crowd mask as a band of sky)
      const n = S.W * S.H, th = S.th, m = new Uint8Array(n)
      let c = 0
      for (let i = 0; i < n; i++) {
        if (not && not[i]) continue
        const j = i * 4
        const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
        if (d > th) { m[i] = 1; c++ }
      }
      m.count = c
      return m
    }
    // the roster's instanced body parts: npc.js instMat / instMatRound are
    // vertexColors over PALETTE.sail (0xfaf6ec). wow-still.js keyed on the
    // 72-vertex torso alone, which left heads, limbs and hats in its floor.
    S.isRoster = (o) => o.isInstancedMesh && o.material && o.material.vertexColors && o.material.color && o.material.color.getHex() === 0xfaf6ec
    S.isWeather = (o) => o.isInstancedMesh && o.renderOrder === 6
    // sway-hooked foliage and grass: shared.js's swayMesh keys 'sway<k>' (the
    // leaf term prefixes it 'leaf1|'), grass.js keys 'swayDgrass'. wow-still
    // tested indexOf('swayD') === 0, which is the grass alone.
    S.isSway = (o) => { const m = o.material; if (!m || !m.customProgramCacheKey) return false; const k = String(m.customProgramCacheKey()); return k.indexOf('sway') >= 0 }
    // a snapshot of every renderable's world translation, and every instance's,
    // so that anything that moved over 120 ms can be named without knowing
    // what it is called
    S.snap = () => {
      const m = new Map()
      g.scene.traverse(o => {
        if (!(o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine)) return
        if (!o.visible) return
        const e = o.matrixWorld.elements
        m.set(o, { x: e[12], y: e[13], z: e[14], inst: o.isInstancedMesh ? o.instanceMatrix.array.slice(0, o.count * 16) : null })
      })
      return m
    }
    S.movers = (m0) => {
      const out = []
      g.scene.traverse(o => {
        const r = m0.get(o)
        if (!r) return
        const e = o.matrixWorld.elements
        if (Math.abs(e[12] - r.x) > 0.01 || Math.abs(e[13] - r.y) > 0.01 || Math.abs(e[14] - r.z) > 0.01) { out.push(o); return }
        if (r.inst && o.isInstancedMesh) {
          const a = o.instanceMatrix.array
          for (let i = 0; i < o.count; i++) {
            const k = i * 16
            if (Math.abs(a[k + 12] - r.inst[k + 12]) > 0.01 || Math.abs(a[k + 13] - r.inst[k + 13]) > 0.01 || Math.abs(a[k + 14] - r.inst[k + 14]) > 0.01) { out.push(o); return }
          }
        }
      })
      return out
    }
    S.capyGroup = g.capy && (g.capy.model || g.capy.group)
    S.png = async (name, frames) => {
      // a 2x2 sheet at half size: A | B over mask | diff
      const w = S.W >> 1, h = S.H >> 1
      const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2
      const x = c.getContext('2d')
      const put = (data, dx, dy) => {
        const t = document.createElement('canvas'); t.width = S.W; t.height = S.H
        const tc = t.getContext('2d')
        const id = tc.createImageData(S.W, S.H); id.data.set(data); tc.putImageData(id, 0, 0)
        x.drawImage(t, 0, 0, S.W, S.H, dx, dy, w, h)
      }
      put(frames.a, 0, 0); put(frames.b, w, 0)
      const vis = (mask, moved) => {
        const d = new Uint8ClampedArray(S.W * S.H * 4)
        for (let i = 0; i < S.W * S.H; i++) {
          const j = i * 4
          const inM = mask[i], mv = moved && moved[i]
          d[j] = mv ? 255 : (inM ? 90 : 20); d[j + 1] = mv ? 60 : (inM ? 90 : 20); d[j + 2] = mv ? 60 : (inM ? 110 : 24); d[j + 3] = 255
        }
        return d
      }
      put(vis(frames.mask, null), 0, h); put(vis(frames.mask, frames.moved), w, h)
      const b64 = c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
      await fetch('/shot?name=' + name, { method: 'POST', body: b64 })
    }
  })


  // ---- the census: who is alive in this chapter ----------------------------
  // Weather and sway are hidden for the whole run (intended motion that is
  // neither the animal nor a person). Then a 120 ms snapshot names every
  // renderable whose world translation, or any instance's, moved > 1 cm —
  // traffic, a herd, a ferry, a chapter's own crowd — without knowing what it
  // is called. The living set is the roster's instanced body parts + the live
  // chapter's locals + the instanced movers whose instances are figure-sized
  // (0.4..2.6 m tall, under 2.2 m wide and long, opaque: a chapter crowd, a
  // herd, a scooter with its rider). A moved single Mesh — a van, a ferry,
  // the chiva — is a vehicle, not the NPC layer; it is named and, like the
  // living set, hidden for (a) so nothing but the animal moves in the
  // animal's own frame.
  const census = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE, S = window.__wow2
    const live = g.biome.current
    let weatherN = 0, swayN = 0
    g.scene.traverse(o => { if (S.isWeather(o)) { S.hide(o); weatherN++ } else if ((o.isMesh || o.isInstancedMesh) && S.isSway(o)) { S.hide(o); swayN++ } })
    const m0 = S.snap()
    await new Promise(res => setTimeout(res, 120))
    const movers = S.movers(m0)
    const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
    const inCapy = (o) => { for (let p = o; p; p = p.parent) if (p === S.capyGroup) return true; return false }
    const living = new Set()
    g.scene.traverse(o => { if (S.isRoster(o) && shown(o)) living.add(o) })
    for (const l of (g.locals || [])) if (l.group && l.biome === live && shown(l.group)) living.add(l.group)
    const M0 = new T.Matrix4(), P0 = new T.Vector3(), Q0 = new T.Quaternion(), S0 = new T.Vector3()
    const figureSized = (o) => {
      const m = o.material
      if (!m || m.transparent || m.depthWrite === false) return false   // the drop aura, thermal motes
      const gm = o.geometry
      if (!gm.boundingBox) gm.computeBoundingBox()
      const bb = gm.boundingBox, gw = bb.max.x - bb.min.x, gh = bb.max.y - bb.min.y, gd = bb.max.z - bb.min.z
      const W = [], H = [], D = []
      const step = Math.max(1, Math.floor(o.count / 30))
      for (let i = 0; i < o.count; i += step) {
        o.getMatrixAt(i, M0); M0.decompose(P0, Q0, S0)
        if (Math.abs(S0.x) < 0.05) continue
        W.push(gw * Math.abs(S0.x)); H.push(gh * Math.abs(S0.y)); D.push(gd * Math.abs(S0.z))
      }
      if (!H.length) return false
      const med = a => { a.sort((x, y) => x - y); return a[a.length >> 1] }
      const w = med(W), h = med(H), d = med(D)
      return h >= 0.4 && h <= 2.6 && w <= 2.2 && d <= 2.2
    }
    const peopleInst = [], otherMovers = []
    for (const o of movers) {
      if (S.isWeather(o) || S.isRoster(o) || inCapy(o) || !shown(o)) continue
      if (o.isInstancedMesh && figureSized(o)) { peopleInst.push(o); living.add(o) } else otherMovers.push(o)
    }
    // ...and the parts of those people that are too small to be figures on
    // their own (rioPeopleHeads, rioPeopleHair: 303 instances, 0.25 m tall):
    // an instanced mover with the SAME count whose instance 0 sits within
    // 1.2 m of a people mesh's instance 0 is the same crowd
    const at0 = (o) => { o.getMatrixAt(0, M0); P0.setFromMatrixPosition(M0); return o.localToWorld(P0.clone()) }
    const parts = []
    for (const o of otherMovers) {
      if (!o.isInstancedMesh || o.material.transparent) continue
      const p = at0(o)
      for (const q of peopleInst) if (q.count === o.count && at0(q).distanceTo(p) < 1.2) { parts.push(o); living.add(o); break }
    }
    for (const o of parts) otherMovers.splice(otherMovers.indexOf(o), 1)
    // ...and the hand-built people who are not locals (Sahara's foreground
    // man — the first run had him red in the diff and absent from the mask):
    // a moved single mesh is a person when the largest group around it that
    // still fits a figure (<= 2.6 m tall, <= 2.2 m wide and long) is not the
    // mesh's chapter root; a van or a ferry never fits
    const size = (o) => { const b = new T.Box3().setFromObject(o); return { h: b.max.y - b.min.y, w: b.max.x - b.min.x, d: b.max.z - b.min.z } }
    const figures = []
    for (const o of otherMovers.slice()) {
      if (o.isInstancedMesh || !o.isMesh) continue
      let top = null
      for (let p = o; p && p !== g.scene; p = p.parent) {
        const s = size(p)
        if (s.h > 2.6 || s.w > 2.2 || s.d > 2.2) break
        if (s.h >= 0.4) top = p
      }
      if (!top) continue
      if (!living.has(top)) { living.add(top); figures.push(top) }
      otherMovers.splice(otherMovers.indexOf(o), 1)
    }
    let torso = null
    g.scene.traverse(o => { if (!torso && S.isRoster(o) && shown(o) && o.geometry.attributes.position.count === 72) torso = o })
    S.living = living; S.peopleInst = peopleInst; S.otherMovers = otherMovers; S.torso = torso; S.figures = figures
    const nm = o => (o.name || o.type) + (o.isInstancedMesh ? '[' + o.count + ']' : '')
    return { biome: live, weatherHidden: weatherN, swayHidden: swayN, movers: movers.length, livingObjects: living.size,
             peopleInst: peopleInst.map(nm), peopleParts: parts.map(nm), figures: figures.length, otherMovers: otherMovers.slice(0, 10).map(nm), rosterShown: !!torso }
  })

  // ---- (a) the animal at rest: pin, mask ---------------------------------
  const capySetup = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE, S = window.__wow2
    const grp = S.capyGroup
    // nobody else in the animal's frame: the first Pasto run had a local
    // standing over the animal and two more walking through its mask
    S.hidA = []
    for (const o of S.living) if (o.visible) { S.hidA.push(o); o.visible = false }
    for (const o of S.otherMovers) if (o.visible) { S.hidA.push(o); o.visible = false }
    const box = new T.Box3().setFromObject(grp)
    const c = box.getCenter(new T.Vector3())
    const yaw = (g.capy.group && g.capy.group.rotation.y) || 0
    // front quarter: the face and the near ear — unless a wall is there, then
    // the other quarter, then the rear ones (a cannon ray against the colliders)
    const C = g.CANNON, rf = new C.Vec3(), rt = new C.Vec3(), res = new C.RaycastResult()
    let a = yaw + 0.7
    for (const off of [0.7, -0.7, 2.4, -2.4]) {
      // the ray starts 0.9 m out, past the animal's own body
      res.reset(); rf.set(c.x + Math.sin(yaw + off) * 0.9, c.y + 0.05, c.z + Math.cos(yaw + off) * 0.9); rt.set(c.x + Math.sin(yaw + off) * 3, c.y + 0.15, c.z + Math.cos(yaw + off) * 3)
      if (g.world) g.world.raycastClosest(rf, rt, { skipBackfaces: false }, res)
      if (!res.hasHit) { a = yaw + off; break }
    }
    const cam = g.camera.clone()
    cam.position.set(c.x + Math.sin(a) * 3, c.y + 0.15, c.z + Math.cos(a) * 3)
    cam.lookAt(c.x, c.y, c.z)
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix()
    S.camA = cam
    // the mask, hide-and-diff, both renders in one task so nothing else moves;
    // the animal's own shadow is not the animal, so it casts none for the two
    // mask renders (the first run's mask was the body plus a shadow patch)
    const cs = []
    grp.traverse(o => { if (o.castShadow) { cs.push(o); o.castShadow = false } })
    const shown = S.grab(cam)
    const shown2 = S.grab(cam)
    grp.visible = false
    const gone = S.grab(cam)
    grp.visible = true
    for (const o of cs) o.castShadow = true
    const self = S.diffMask(shown, shown2)
    S.maskA = S.diffMask(shown, gone, self)
    S.selfA = self.count
    S.pairsA = []
    return { center: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], size: [+(box.max.x - box.min.x).toFixed(2), +(box.max.y - box.min.y).toFixed(2), +(box.max.z - box.min.z).toFixed(2)],
             yaw: +yaw.toFixed(2), maskPx: S.maskA.count, selfDiffPx: S.selfA, W: S.W, H: S.H, biome: g.biome.current, hiddenForA: S.hidA.length }
  })
  const pairs = async (which, n) => page.evaluate(async ([which, n]) => {
    const S = window.__wow2
    const cam = which === 'A' ? S.camA : S.camB, mask = which === 'A' ? S.maskA : S.maskB, list = which === 'A' ? S.pairsA : S.pairsB
    for (let k = 0; k < n; k++) {
      const a = S.grab(cam)
      await new Promise(res => setTimeout(res, 120))
      const b = S.grab(cam)
      list.push(S.diffCount(a, b, mask))
      if (k === n - 1) { S.last = { a, b, mask, moved: S.diffMask(a, b) } }
      await new Promise(res => setTimeout(res, 1800))
    }
    return list.slice()
  }, [which, n])
  await pairs('A', 5)
  const pairsA = await pairs('A', 5)
  await page.evaluate(async (name) => { const S = window.__wow2; await S.png(name, S.last) }, 'wow2-motion-' + chapter + '-capy')

  // ---- (b) the densest crowd: find, pin, mask ------------------------------
  const crowdSetup = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE, S = window.__wow2
    const live = g.biome.current
    for (const o of S.hidA) o.visible = true
    S.hidA = []
    const cp = new T.Vector3(); S.capyGroup.getWorldPosition(cp)
    // the figures: one point per person. Locals by group; the roster by its
    // torso (the FIRST 72-vertex roster mesh in scene order — iTorso is made
    // first; three roster parts have 72 vertices and each is ~0.3 m tall, so
    // no height test there); the figure-sized instanced movers by their
    // instances. Deduped at 0.45 m in the ground plane so a body-part crowd
    // counts once.
    const figs = []
    const addFig = (p, kind) => {
      if (!(p.x === p.x) || p.distanceTo(cp) > 80) return
      for (const f of figs) { const dx = f.p.x - p.x, dz = f.p.z - p.z; if (dx * dx + dz * dz < 0.45 * 0.45) return }
      figs.push({ p: p.clone(), kind })
    }
    for (const l of (g.locals || [])) if (l.group && l.biome === live && S.living.has(l.group)) addFig(l.group.getWorldPosition(new T.Vector3()), 'local')
    const M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), Sc = new T.Vector3()
    const instFigs = (o, kind, hMin) => {
      const gm = o.geometry
      if (!gm.boundingBox) gm.computeBoundingBox()
      const gh = gm.boundingBox.max.y - gm.boundingBox.min.y
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); M.decompose(P, Q, Sc)
        const h = gh * Math.abs(Sc.y)
        if (Math.abs(Sc.x) < 0.05 || h < hMin || h > 3) continue
        o.localToWorld(P)
        addFig(P, kind)
      }
    }
    if (S.torso) instFigs(S.torso, 'roster', 0)
    for (const o of S.peopleInst) instFigs(o, 'inst', 0.4)
    for (const o of S.figures) addFig(new T.Box3().setFromObject(o).getCenter(new T.Vector3()), 'figure')
    // the candidates: every figure inside 40 m with its neighbours within 3 m,
    // most neighbours first, nearest first among equals
    // (a pair beyond 40 m beats a loner inside it: Iceland's and Cali's
    // nearest people stand alone)
    const cands = []
    for (const f of figs) {
      const d = f.p.distanceTo(cp)
      if (d > 80) continue
      let n = 0; const cen = new T.Vector3()
      for (const q of figs) if (q.p.distanceTo(f.p) <= 3) { n++; cen.add(q.p) }
      cen.multiplyScalar(1 / n)
      cands.push({ n, d, cen, kind: f.kind, score: (n >= 2 ? 2 : 0) + (d <= 40 ? 1 : 0) })
    }
    cands.sort((a, b) => b.score - a.score || b.n - a.n || a.d - b.d)
    S.hide(S.capyGroup); S.capyHidden = S.capyGroup
    const kinds = {}; for (const f of figs) kinds[f.kind] = (kinds[f.kind] || 0) + 1
    // ...and the first whose living mask actually renders (a parked roster
    // has matrices but no pixels — Kyoto's first run pinned on 40 px)
    let best = null, tried = 0
    // ...and a lens that can actually see them: the animal's side first, then
    // round the clock by 45 degrees; the lens sits 6 m out at 1.5 m over the
    // cluster's feet, never under the chapter's terrain, and a bearing is
    // accepted only when the living mask has pixels in a 48 px window around
    // the cluster's projected chest — the first Rio run pinned inside a drawn
    // hillside with no collider and measured a black frame with feet along
    // its top edge; a cannon ray had called that line clear.
    const api = live === 'sydney' ? g.env : g[live]
    const th = (x, z) => { if (!api || typeof api.terrainHeight !== 'function') return -1e9; const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : -1e9 }
    const windowPx = (mask, p, cam) => {
      const v = p.clone().project(cam)
      if (v.z >= 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return 0
      const cx = Math.round((v.x + 1) / 2 * S.W), cy = Math.round((1 - v.y) / 2 * S.H)
      let n = 0
      for (let y = Math.max(0, cy - 24); y < Math.min(S.H, cy + 24); y++)
        for (let x = Math.max(0, cx - 24); x < Math.min(S.W, cx + 24); x++) if (mask[y * S.W + x]) n++
      return n
    }
    let bearings = 0
    // (one try per distinct cluster: the chiva's eighteen passengers are
    // eighteen candidates with one centroid, and they used up every slot)
    const triedAt = []
    for (const cand of cands) {
      if (tried >= 12) break
      if (triedAt.some(p => p.distanceTo(cand.cen) < 2.5)) continue
      triedAt.push(cand.cen)
      tried++
      const dir0 = new T.Vector3().subVectors(cp, cand.cen); dir0.y = 0
      if (dir0.lengthSq() < 1e-4) dir0.set(1, 0, 0); dir0.normalize()
      const a0 = Math.atan2(dir0.x, dir0.z)
      const chest = new T.Vector3(cand.cen.x, cand.cen.y + 0.8, cand.cen.z)
      for (let k = 0; k < 8 && !best; k++) {
        bearings++
        const a = a0 + [0, 0.785, -0.785, 1.571, -1.571, 2.356, -2.356, 3.142][k]
        const cx = cand.cen.x + Math.sin(a) * 6, cz = cand.cen.z + Math.cos(a) * 6
        const cy = Math.max(cand.cen.y + 1.5, th(cx, cz) + 1.5)
        const cam = g.camera.clone()
        cam.position.set(cx, cy, cz)
        cam.lookAt(chest)
        cam.updateMatrixWorld(true); cam.updateProjectionMatrix()
        // the living mask: hide the living set, render, show, render — one task
        const shown = S.grab(cam)
        const shown2 = S.grab(cam)
        const was = []
        for (const o of S.living) if (o.visible) { was.push(o); o.visible = false }
        const gone = S.grab(cam)
        for (const o of was) o.visible = true
        const self = S.diffMask(shown, shown2)
        const mask = S.diffMask(shown, gone, self)
        const win = windowPx(mask, chest, cam)
        // a far pair has to be worth the trip: Cali's first pick was the
        // chiva's passengers 76 m off, 619 px of them showing through the bus
        if (mask.count < (cand.d > 40 ? 2000 : 300) || win < 40) continue
        S.selfB = self.count
        let inView = 0
        for (const f of figs) {
          const v = f.p.clone().project(cam)
          if (v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && f.p.distanceTo(cam.position) <= 30) inView++
        }
        S.camB = cam; S.maskB = mask; S.pairsB = []
        best = { n: cand.n, distFromCapy: +cand.d.toFixed(1), centroid: [+cand.cen.x.toFixed(1), +cand.cen.y.toFixed(1), +cand.cen.z.toFixed(1)], kind: cand.kind,
                 bearing: k, camY: +cy.toFixed(1), windowPx: win, inView, maskPx: mask.count, selfDiffPx: self.count, tried, bearings }
      }
    }
    if (!best) { S.camB = null; return { figures: figs.length, kinds, candidates: cands.length, cluster: null, tried } }
    return { figures: figs.length, kinds, candidates: cands.length, cluster: best, inView: best.inView, maskPx: best.maskPx }
  })
  let pairsB = []
  if (crowdSetup.cluster) {
    await pairs('B', 5)
    pairsB = await pairs('B', 5)
    await page.evaluate(async (name) => { const S = window.__wow2; await S.png(name, S.last) }, 'wow2-motion-' + chapter + '-crowd')
  }
  // restore
  await page.evaluate(() => { const S = window.__wow2; for (const o of S.hidden) o.visible = true; S.hidden = []; if (S.capyHidden) { S.capyHidden.visible = true; S.capyHidden = null } })

  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s.length & 1 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
  const stats = (setup, p) => ({ pairs: p, meanMoved: +mean(p).toFixed(1), medianMoved: median(p), pxPerSec: +(mean(p) / 0.12).toFixed(0), medianPxPerSec: +(median(p) / 0.12).toFixed(0),
                                 movedPctOfMask: setup.maskPx ? +(100 * mean(p) / setup.maskPx).toFixed(2) : null })
  const out = {
    chapter, errs, census,
    capy: Object.assign({}, capySetup, stats(capySetup, pairsA)),
    crowd: Object.assign({}, crowdSetup, stats(crowdSetup, pairsB)),
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-motion-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
