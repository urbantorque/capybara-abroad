async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, rows: [] }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const px = async () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera
    const box = new T.Box3().setFromObject(g.capy.group)
    const pts = []
    for (let i = 0; i < 8; i++) { const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); p.project(cam); pts.push(p) }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const W = 320, H = 190
    const r = g.renderer
    const RT = window.__l7rt || (window.__l7rt = new T.WebGLRenderTarget(W, H))
    const pA = window.__l7pa || (window.__l7pa = new Uint8Array(W * H * 4))
    const pB = window.__l7pb || (window.__l7pb = new Uint8Array(W * H * 4))
    const t0 = performance.now()
    const prevRT = r.getRenderTarget(), prevAuto = r.shadowMap.autoUpdate
    r.shadowMap.autoUpdate = false
    r.setRenderTarget(RT); r.render(g.scene, cam); r.readRenderTargetPixels(RT, 0, 0, W, H, pA)
    g.capy.group.visible = false
    r.render(g.scene, cam); r.readRenderTargetPixels(RT, 0, 0, W, H, pB)
    g.capy.group.visible = true
    r.setRenderTarget(prevRT); r.shadowMap.autoUpdate = prevAuto
    const bx0 = Math.max(0, Math.floor((x0 + 1) / 2 * W) - 2), bx1 = Math.min(W - 1, Math.ceil((x1 + 1) / 2 * W) + 2)
    const by0 = Math.max(0, Math.floor((y0 + 1) / 2 * H) - 2), by1 = Math.min(H - 1, Math.ceil((y1 + 1) / 2 * H) + 2)
    let pxBox = 0, pxAll = 0, sumA = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4
      sumA += pA[k] + pA[k + 1] + pA[k + 2]
      const d = Math.max(Math.abs(pA[k] - pB[k]), Math.abs(pA[k + 1] - pB[k + 1]), Math.abs(pA[k + 2] - pB[k + 2]))
      if (d > 20) { pxAll++; if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) pxBox++ }
    }
    return { ms: +(performance.now() - t0).toFixed(0), box: [bx0, by0, bx1, by1], pxBox, pxAll, meanA: +(sumA / (W * H * 3)).toFixed(1), err: g.state.lastError ? String(g.state.lastError).slice(0, 100) : null }
  })
  out.rows.push(await px())
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000)
  out.rows.push(await px())
  await page.keyboard.up('KeyW'); await page.waitForTimeout(1500)
  out.rows.push(await px())
  await page.evaluate(() => { window.__capy.state.noLensCap = true }); await page.waitForTimeout(300)
  out.rows.push(await px())
  await page.screenshot({ path: 'qa/l7-e3-pxtest.png' })
  await page.evaluate((o) => fetch('/shot?name=l7-e3-pxtest.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
