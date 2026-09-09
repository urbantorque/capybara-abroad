async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    g.input.x = 0; g.input.z = 0
  })
  await page.waitForTimeout(10800)
  const out = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, cam = g.camera, v = new T.Vector3()
    const fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const half = Math.cos((cam.fov / 2) * Math.PI / 180 * 1.6)   // generous cone
    const rows = []
    g.scene.traverse(o => {
      if (!o.isMesh || o.renderOrder !== -1) return
      if (!o.material || o.material.blending !== T.AdditiveBlending) return
      const pos = o.geometry.attributes.position
      let inCone = 0, ahead = 0, best = -2
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i); o.localToWorld(v)
        const d = v.sub(cam.position).normalize().dot(fwd)
        if (d > 0) ahead++
        if (d > half) inCone++
        if (d > best) best = d
      }
      rows.push({ n: pos.count, ahead, inCone, bestDot: +best.toFixed(3), vis: o.visible,
                  op: +o.material.opacity.toFixed(3) })
    })
    const rigPos = new T.Vector3()
    let rig = null
    g.scene.traverse(o => { if (o.isGroup && o.children.some(c => c.renderOrder === -1)) rig = o })
    if (rig) rig.getWorldPosition(rigPos)
    return { aur: +g.iceland.aurora().toFixed(2), sky: +g.iceland.skyward().toFixed(2),
             camPos: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
             capyPos: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)],
             fwd: [+fwd.x.toFixed(2), +fwd.y.toFixed(2), +fwd.z.toFixed(2)],
             rig: rig ? [+rigPos.x.toFixed(1), +rigPos.y.toFixed(1), +rigPos.z.toFixed(1)] : null,
             curtains: rows }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice9.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
