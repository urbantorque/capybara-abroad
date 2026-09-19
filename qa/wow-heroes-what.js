async page => {
  // Part C Heroes: what is that in the frame? Arrive, then raycast a few NDC
  // points from the live lens and name the hit (object name, instanceId, point).
  const KEY = 'Slash'
  const PTS = [[-0.8, 0.2], [-0.6, 0.4], [-0.9, -0.2], [0.3, 0.45], [0.8, 0.5]]
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(8000)
  const out = await page.evaluate((PTS) => {
    const g = window.__capy, T = g.THREE
    const rc = new T.Raycaster(); rc.far = 5000
    const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    const rows = []
    for (const q of PTS) {
      rc.setFromCamera(new T.Vector2(q[0], q[1]), g.camera)
      const h = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder !== -20)[0]
      if (!h) { rows.push({ q, hit: null }); continue }
      let nm = h.object.name, par = h.object.parent && h.object.parent.name
      rows.push({ q, name: nm, parent: par, inst: h.instanceId, isInst: !!h.object.isInstancedMesh,
                  d: +h.distance.toFixed(1), p: [+h.point.x.toFixed(1), +h.point.y.toFixed(1), +h.point.z.toFixed(1)],
                  tris: h.object.geometry ? (h.object.geometry.index ? h.object.geometry.index.count / 3 : h.object.geometry.attributes.position.count / 3) : 0 })
    }
    const c = g.camera.getWorldPosition(new T.Vector3()), d = g.camera.getWorldDirection(new T.Vector3())
    return { cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], dir: [+d.x.toFixed(3), +d.y.toFixed(3), +d.z.toFixed(3)], rows }
  }, PTS)
  await page.evaluate(async (o) => { await fetch('/shot?name=wowh-what.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
