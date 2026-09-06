async page => {
  // IS THE ANKLE BAND VISIBLE, AND BY HOW MUCH?
  //
  // An A/B on the band itself, in one frame, the way qa/wear-parts.js does it
  // for a costume: render, put the four shins' banded vertices back to the
  // flank they would have had without the band, render again, and diff. The
  // band is a full-weight mix toward FLANK x 0.82^2.4 on every vertex below the
  // ankle ring and nothing else touches those vertices (the nook is +y and
  // these are the -y end), so dividing them by 0.82^2.4 restores them exactly.
  //
  // Two poses, because the loaf hides most of a leg and the standing pose does
  // not, and this band exists for both.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  async function shoot (tag) {
    return page.evaluate(async (tag) => {
      const g = window.__capy, T = g.THREE
      const K = Math.pow(0.82, 2.4)
      const W = 900, H = 560
      g.renderer.setSize(W, H, false)
      const shins = []
      g.capy.group.traverse(o => {
        if (o.isGroup && o.children.length === 2 &&
            o.children[0].isMesh && o.children[1].isMesh &&
            Math.abs(Math.abs(o.position.x) - 0.15) < 1e-6 &&
            Math.abs(o.position.z) > 0.2 && Math.abs(o.position.z) < 0.34) shins.push(o.children[0])
      })
      if (shins.length !== 4) return { err: 'shins ' + shins.length }

      const my = g.capy.group.rotation.y, p = g.capy.position
      const cam = (yawOff, dist, hgt) => {
        const yaw = my + yawOff
        const c = new T.PerspectiveCamera(30, W / H, 0.01, 400)
        const aim = new T.Vector3(p.x, p.y - 0.20, p.z)
        c.position.set(aim.x + Math.sin(yaw) * dist, aim.y + hgt, aim.z + Math.cos(yaw) * dist)
        c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
        return c
      }
      const grab = (c) => {
        g.renderer.render(g.scene, c)
        const cv = g.renderer.domElement
        const t = document.createElement('canvas')
        t.width = W; t.height = H
        t.getContext('2d').drawImage(cv, 0, 0)
        return t.getContext('2d').getImageData(0, 0, W, H).data
      }
      const views = [['3q', Math.PI * 0.72, 1.5, 0.22], ['side', Math.PI * 0.5, 1.4, 0.14]]
      const on = views.map(v => grab(cam(v[1], v[2], v[3])))

      // ---- the band OFF, in place ----------------------------------------
      const scale = (k) => shins.forEach(s => {
        const pos = s.geometry.attributes.position, col = s.geometry.attributes.color
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) >= -0.101) continue
          col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k)
        }
        col.needsUpdate = true
      })
      scale(1 / K)
      const off = views.map(v => grab(cam(v[1], v[2], v[3])))
      scale(K)

      const out = { err: null, tag, views: [] }
      for (let v = 0; v < views.length; v++) {
        let n = 0, dSum = 0, aSum = 0
        const A = on[v], B = off[v]
        for (let i = 0; i < A.length; i += 4) {
          const la = 0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]
          const lb = 0.299 * B[i] + 0.587 * B[i + 1] + 0.114 * B[i + 2]
          if (Math.abs(la - lb) < 1.5) continue
          n++; dSum += lb - la; aSum += lb
        }
        out.views.push({ view: views[v][0], px: n,
                         meanDrop: n ? Math.round(dSum / n * 100) / 100 : 0,
                         asFraction: n ? Math.round((1 - (aSum / n - dSum / n) / (aSum / n)) * 1000) / 1000 : 0 })
      }
      // and keep the pictures for the eye
      for (let v = 0; v < views.length; v++) {
        g.renderer.render(g.scene, cam(views[v][1], views[v][2], views[v][3]))
        await fetch('/shot?name=R4b-' + tag + '-' + views[v][0], { method: 'POST',
          body: g.renderer.domElement.toDataURL('image/png') })
      }
      return out
    }, tag)
  }

  const loaf = await shoot('loaf')

  // ---- and standing, which is where a whole shin is on show ---------------
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1400)
  await page.keyboard.up('KeyW')
  const stand = await page.evaluate(() => window.__capy.capy.loaf)
  const up = await shoot('stand')

  const out = { loaf, up, loafAtStand: stand, errs }
  await page.evaluate(async o => {
    await fetch('/shot?name=R4b-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
