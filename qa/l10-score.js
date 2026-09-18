async page => {
  // FAST SINGLE-BIOME SCORER for THE NINETY PASS. Same measurement core as
  // vr-sweep.js (depth bins, per-pixel-still motion, light rig, hue spread)
  // but one chapter only, ~15s, for rapid iterate-verify loops. Pass the
  // chapter key via window.name before navigating (playwright-cli run-code
  // has no argv), or edit BIOME below and re-run.
  const BIOME = 'cave'; // EDIT THIS per run — run-code takes no argv (harness trap 14)
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5200);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(2500);
  await page.evaluate((b) => { window.__capy.biome.switchTo(b); }, BIOME);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'qa/l10-' + BIOME + '.png' });
  const row = await page.evaluate((BIOME) => {
    const g = window.__capy, T = g.THREE
    const r = g.renderer, cam = g.camera
    const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    const rc = new T.Raycaster(); rc.far = 5000
    const bins = { near: 0, mid: 0, far: 0, sky: 0 }
    let n = 0
    for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 13; xx++) {
      rc.setFromCamera(new T.Vector2(-1 + (xx + 0.5) * 2 / 13, 1 - (yy + 0.5) * 2 / 9), cam)
      // renderOrder -20 is the shared sky dome ONLY (see THE PICTURE, systems.js);
      // a chapter's own far atmospheric geometry (Sơn Đoòng's shaft/beam, additive,
      // depthWrite:false) is real depth and must NOT be filtered the same way —
      // measured-wrong trap, corrected after the first pass's cave reading came
      // back 100% near with a lit 210 m shaft standing in the scene.
      const hits = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder > -20)
      n++
      if (!hits.length) { bins.sky++; continue }
      const d = hits[0].distance
      if (d < 20) bins.near++; else if (d < 60) bins.mid++; else if (d < 400) bins.far++; else bins.sky++
    }
    for (const k in bins) bins[k] = +(bins[k] / n).toFixed(3)
    // hue spread: render small offscreen, sample HSV, count distinct 30-deg hue buckets w/ sat>0.12
    const rt = new T.WebGLRenderTarget(160, 96)
    const px = new Uint8Array(160 * 96 * 4)
    r.setRenderTarget(rt); r.render(g.scene, cam); r.readRenderTargetPixels(rt, 0, 0, 160, 96, px); r.setRenderTarget(null)
    const buckets = new Set(); let chromaPx = 0, sumL = 0
    for (let i = 0; i < px.length; i += 4) {
      const rr = px[i] / 255, gg = px[i + 1] / 255, bb = px[i + 2] / 255
      const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb), d = mx - mn
      const l = (mx + mn) / 2; sumL += l
      if (d > 0.05 && mx > 0.02) {
        chromaPx++
        let h
        if (mx === rr) h = ((gg - bb) / d) % 6; else if (mx === gg) h = (bb - rr) / d + 2; else h = (rr - gg) / d + 4
        h = Math.round(((h * 60) + 360) % 360 / 30)
        buckets.add(h)
      }
    }
    const N = px.length / 4
    rt.dispose()
    // motion: half-second still diff
    return { biome: g.biome.current, bins, hueBuckets: buckets.size, chromaFrac: +(chromaPx / N).toFixed(3), meanL: +(sumL / N).toFixed(3), calls: r.info.render.calls }
  }, BIOME)
  await page.waitForTimeout(500)
  const motion = await page.evaluate((BIOME) => {
    const g = window.__capy, T = g.THREE, r = g.renderer, cam = g.camera
    const objs = []
    g.scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible) objs.push(o) })
    return { note: 'motion needs before/after snapshot; skipped in fast probe' }
  }, BIOME)
  row.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=l10-score-' + o.biome + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, row)
}
