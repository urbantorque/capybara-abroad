async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit4'); // kyoto
  await page.waitForTimeout(8500);
  await page.screenshot({ path: 'qa/l10-kyoto-arrive.png' });
  const res = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera
    const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    // the documented landmarks: hill summit (-34,-128), pond centre (26,-6)
    const targets = { hill: { x: -34, z: -128, y: 8 }, pond: { x: 26, z: -6, y: 0.5 } }
    const capy = g.capy.position
    const camPos = cam.getWorldPosition(new T.Vector3())
    // exclude the animal's own body from occlusion — capy3-visibility-metrics.md
    const selfMeshes = new Set()
    const capyRoot = g.capy.model || g.capy.group
    if (capyRoot) capyRoot.traverse(o => selfMeshes.add(o))
    const out = {}
    for (const k in targets) {
      const t = targets[k]
      const dir = new T.Vector3(t.x - camPos.x, t.y - camPos.y, t.z - camPos.z)
      const dist = dir.length(); dir.normalize()
      const rc = new T.Raycaster(camPos.clone(), dir)
      rc.far = dist + 1
      const hits = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder !== -20 && !selfMeshes.has(h.object))
      out[k] = { dist: +dist.toFixed(1), firstHitDist: hits.length ? +hits[0].distance.toFixed(1) : null, clear: !hits.length || hits[0].distance > dist - 3, blocker: hits.length ? (hits[0].object.name || hits[0].object.geometry.type) : null }
      const ndc = new T.Vector3(t.x, t.y, t.z).project(cam)
      out[k].inFrustum = Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1
      out[k].ndc = [+ndc.x.toFixed(2), +ndc.y.toFixed(2)]
    }
    return { capy: { x: +capy.x.toFixed(1), y: +capy.y.toFixed(1), z: +capy.z.toFixed(1) }, camPos: [+camPos.x.toFixed(1), +camPos.y.toFixed(1), +camPos.z.toFixed(1)], out, err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=l10-kyoto-sightline.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, res)
}
