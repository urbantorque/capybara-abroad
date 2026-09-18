async page => {
  // VISUAL REVIEW SWEEP (19 Sep 2026). Per chapter: arrival frame, a running
  // frame, an orbited frame, and a numbers row: where the frame is (near /
  // mid / far / sky), how much of it MOVES with the camera still (per-pixel
  // diff of two small offscreen renders 0.5 s apart), how many objects moved,
  // and the render / light / post state. Real rAF, real keys, Begin button.
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash']
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi']
  const out = []
  await page.setViewportSize({ width: 1280, height: 760 })
  for (let i = 0; i < 19; i++) {
    const n2 = String(i + 1).padStart(2, '0')
    const tag = 'VR-' + n2 + '-' + NAMES[i]
    try {
      await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
      await page.reload()
      await page.waitForTimeout(5200)
      await page.keyboard.press(KEYS[i])
      await page.waitForTimeout(8500)
      await page.screenshot({ path: 'qa/' + tag + '-a.png' })

      const row = await page.evaluate(() => {
        const g = window.__capy, T = g.THREE
        const r = g.renderer, cam = g.camera
        const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
        // --- where the frame is: 13x9 NDC ray grid
        const rc = new T.Raycaster(); rc.far = 5000
        const bins = { near: 0, mid: 0, far: 0, sky: 0 }
        let n = 0
        for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 13; xx++) {
          rc.setFromCamera(new T.Vector2(-1 + (xx + 0.5) * 2 / 13, 1 - (yy + 0.5) * 2 / 9), cam)
          const hits = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder > -20 && !(h.object.material && h.object.material.depthWrite === false && h.distance > 150))
          n++
          if (!hits.length) { bins.sky++; continue }
          const d = hits[0].distance
          if (d < 20) bins.near++; else if (d < 60) bins.mid++; else if (d < 400) bins.far++; else bins.sky++
        }
        for (const k in bins) bins[k] = +(bins[k] / n).toFixed(3)
        // --- lights
        const lights = []
        let sunEl = null, shadowRes = null
        g.scene.traverse(o => {
          if (o.isLight && vis(o)) {
            const e = { t: o.type.replace('Light', ''), i: +o.intensity.toFixed(2), c: '#' + o.color.getHexString() }
            if (o.isDirectionalLight) {
              const d = o.position.clone().sub(o.target.position).normalize()
              e.el = Math.round(Math.asin(d.y) * 180 / Math.PI)
              if (o.castShadow) { sunEl = e.el; shadowRes = o.shadow.mapSize.x; e.sh = o.shadow.mapSize.x; e.box = o.shadow.camera.right }
            }
            if (o.isHemisphereLight) e.g = '#' + o.groundColor.getHexString()
            lights.push(e)
          }
        })
        // --- census of moving objects: snapshot world matrices
        const objs = []
        g.scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && vis(o)) objs.push(o) })
        window.__vrSnap = objs.map(o => ({ o, m: o.matrixWorld.clone(), inst: o.isInstancedMesh ? o.instanceMatrix.array.slice(0, Math.min(o.instanceMatrix.array.length, 16 * 64)) : null }))
        // --- offscreen small render for the pixel diff
        const rt = new T.WebGLRenderTarget(192, 114)
        window.__vrRT = rt
        const px = new Uint8Array(192 * 114 * 4)
        r.setRenderTarget(rt); r.render(g.scene, cam); r.readRenderTargetPixels(rt, 0, 0, 192, 114, px); r.setRenderTarget(null)
        window.__vrPx = px
        const fog = g.scene.fog
        const p = g.post && g.post.params || {}
        const pick = {}
        for (const k of ['bloom','threshold','contrast','saturation','vignette','tint','wide','splitW','splitC','dof','air','crease','dofNear1','dofFar0','shoulder']) if (k in p) pick[k] = Array.isArray(p[k]) ? p[k].map(v => +v.toFixed(2)) : +(+p[k]).toFixed(3)
        return {
          biome: g.biome && g.biome.current, started: g.state.started,
          calls: r.info.render.calls, tris: r.info.render.triangles,
          meshes: objs.length, inst: objs.filter(o => o.isInstancedMesh).length,
          bins, lights, sunEl, shadowRes,
          fog: fog ? (fog.isFogExp2 ? { d: fog.density } : { near: Math.round(fog.near), far: Math.round(fog.far), c: '#' + fog.color.getHexString() }) : null,
          bg: g.scene.background && g.scene.background.isColor ? '#' + g.scene.background.getHexString() : String(g.scene.background && g.scene.background.type),
          post: pick, camFov: cam.fov, camY: +cam.position.y.toFixed(1), capyY: +g.capy.position.y.toFixed(1),
          err: g.state.lastError || null
        }
      })
      // let the world run half a second with the camera still, then diff
      await page.waitForTimeout(500)
      const motion = await page.evaluate(() => {
        const g = window.__capy, T = g.THREE, r = g.renderer, cam = g.camera
        const rt = window.__vrRT, a = window.__vrPx
        const b = new Uint8Array(192 * 114 * 4)
        r.setRenderTarget(rt); r.render(g.scene, cam); r.readRenderTargetPixels(rt, 0, 0, 192, 114, b); r.setRenderTarget(null)
        let moved = 0, sum = 0, peak = 0
        for (let i = 0; i < a.length; i += 4) {
          const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]))
          if (d > 2) { moved++; sum += d; if (d > peak) peak = d }
        }
        const N = a.length / 4
        // object census
        let movedObjs = 0, movedInst = 0, total = 0
        const kinds = {}
        for (const s of window.__vrSnap) {
          total++
          let mv = false
          const e1 = s.m.elements, e2 = s.o.matrixWorld.elements
          for (let k = 0; k < 16; k++) if (Math.abs(e1[k] - e2[k]) > 1e-4) { mv = true; break }
          if (!mv && s.inst) { const cur = s.o.instanceMatrix.array; for (let k = 0; k < s.inst.length; k++) if (Math.abs(s.inst[k] - cur[k]) > 1e-4) { mv = true; movedInst++; break } }
          if (mv) { movedObjs++; const gt = s.o.geometry.type.replace('Geometry', ''); kinds[gt] = (kinds[gt] || 0) + 1 }
        }
        // shader-time motion: materials with a time uniform
        let timeMats = 0
        const seen = new Set()
        g.scene.traverse(o => { const m = o.material; if (m && !seen.has(m.uuid) && vis(o)) { seen.add(m.uuid); const u = m.uniforms || (m.userData && m.userData.uniforms); if (u && (u.uTime || u.time || u.uT)) timeMats++ } })
        function vis(o) { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
        rt.dispose(); delete window.__vrRT; delete window.__vrPx; delete window.__vrSnap
        return { pxMoved: +(moved / N).toFixed(3), pxMean: moved ? +(sum / moved).toFixed(1) : 0, pxPeak: peak, movedObjs, movedInst, total, kinds, timeMats }
      })
      row.motion = motion
      // run frame
      await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
      await page.waitForTimeout(2200)
      await page.screenshot({ path: 'qa/' + tag + '-b.png' })
      await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
      // orbit
      await page.keyboard.down('KeyZ'); await page.waitForTimeout(1300); await page.keyboard.up('KeyZ')
      await page.waitForTimeout(2600)
      await page.screenshot({ path: 'qa/' + tag + '-c.png' })
      row.want = NAMES[i]
      out.push(row)
    } catch (e) {
      out.push({ want: NAMES[i], fail: String(e.message || e) })
    }
  }
  await page.evaluate(o => fetch('/shot?name=vr-sweep.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
