async page => {
  // ---------------------------------------------------------------------------
  // qa/poster-premise.js — CAN THIS GAME PUT A PICTURE ON A THING? (item 6, B15)
  //
  // The poster bullet asks for "one grabbable wanted-poster per chapter,
  // textured with the player's own album thumbnail". Three premises under
  // that sentence, and none of them has ever been true in this repository:
  //
  //   1. THERE ARE NO TEXTURES. One grep of src: a single 1x1 black
  //      DataTexture in main.js, used as a post-processing fallback. Nineteen
  //      chapters of hand-built scenery and not one image on a surface. So
  //      this measures whether a data-URL texture renders AT ALL here, and
  //      whether it survives the composite pass (v40's lens, exposure, the
  //      airlight) looking like the photograph it came from.
  //   2. THE ALBUM MAY BE EMPTY. The poster is meant to appear from tier 3,
  //      which is a score of 26 — a long way in — but photography is entirely
  //      optional and nothing in the game asks for it. If most players reach
  //      tier 3 with an empty album then the FALLBACK is the feature and the
  //      photograph is the exception, which is the opposite of the bullet.
  //   3. IT IS A SIGN WITH WORDS ON IT. The exit board — the most important
  //      object in every chapter — was deliberately built as six rows of
  //      split-flap colour chips because "this game has no text in the world
  //      and is not about to grow a font atlas". A wanted poster is the same
  //      question asked again.
  //
  // This probe answers 1 and 2. 3 is an argument, not a measurement.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const out = {}

  // ---- 2a: what is in the album on a fresh file ---------------------------
  out.empty = await page.evaluate(() => window.__capy.hud.albumAudit
    ? window.__capy.hud.albumAudit()
    : { n: (JSON.parse(localStorage.getItem('capy3.album.v1') || '{"shots":[]}').shots || []).length })

  // ---- 2b: take one, the way a player does — K, then Enter ----------------
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(2500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  await page.keyboard.press('KeyK')
  await page.waitForTimeout(1500)
  out.afterOne = await page.evaluate(() => {
    let a = []
    try { a = JSON.parse(localStorage.getItem('capy3.album.v1') || '{}').shots || [] } catch (e) {}
    return { n: a.length, place: a.length ? a[a.length - 1].place : null,
             cap: a.length ? a[a.length - 1].cap : null,
             bytes: a.length ? a[a.length - 1].u.length : 0,
             head: a.length ? a[a.length - 1].u.slice(0, 30) : null }
  })

  // ---- 1: does a texture from that data URL render? -----------------------
  // Built in front of the camera at a fixed offset, so what comes back is a
  // photograph of a photograph and the composite pass is in between them.
  out.tex = await page.evaluate(async () => {
    const g = window.__capy
    const THREE = g.THREE || (g.three)
    if (!THREE) return { err: 'no THREE on the game object' }
    let a = []
    try { a = JSON.parse(localStorage.getItem('capy3.album.v1') || '{}').shots || [] } catch (e) {}
    if (!a.length) return { err: 'nothing in the album' }
    const url = a[a.length - 1].u
    const img = new Image()
    const ok = await new Promise(r => {
      img.onload = () => r(true); img.onerror = () => r(false); img.src = url
    })
    if (!ok) return { err: 'the image would not decode' }
    const tex = new THREE.Texture(img)
    tex.needsUpdate = true
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.0),
      new THREE.MeshBasicMaterial({ map: tex })
    )
    const cam = g.camera
    m.position.copy(cam.position)
    const d = new THREE.Vector3()
    cam.getWorldDirection(d)
    m.position.addScaledVector(d, 2.2)
    m.quaternion.copy(cam.quaternion)
    g.scene.add(m)
    window.__poster = m
    return { ok: true, w: img.width, h: img.height,
             colorSpace: ('colorSpace' in tex) ? tex.colorSpace : 'n/a' }
  })
  await page.waitForTimeout(1500)
  {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: 'poster-tex.png', b: b.toString('base64') })
  }
  await page.evaluate(() => {
    if (window.__poster) { window.__capy.scene.remove(window.__poster); window.__poster = null }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=poster-premise.json', { method: 'POST', body: s })
  }, Object.assign({ errs: errs.slice(0, 6), errN: errs.length }, out))
}
