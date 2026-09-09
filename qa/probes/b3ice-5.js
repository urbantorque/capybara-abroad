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
  await page.waitForTimeout(10500)
  const out = await page.evaluate(() => {
    const g = window.__capy, I = g.iceland, T = g.THREE
    const cam = g.camera
    const v = new T.Vector3()
    const rows = []
    g.scene.traverse(o => {
      if (!o.isMesh || !o.visible || o.renderOrder !== -1) return
      if (!o.material || o.material.blending !== T.AdditiveBlending) return
      const pos = o.geometry.attributes.position
      let minY = 9, maxY = -9, minX = 9, maxX = -9, minEl = 999, maxEl = -999, front = 0
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
        o.localToWorld(v)
        const el = Math.atan2(v.y - cam.position.y,
                              Math.hypot(v.x - cam.position.x, v.z - cam.position.z)) * 57.2958
        if (el < minEl) minEl = el
        if (el > maxEl) maxEl = el
        const c = v.clone().project(cam)
        // z<1 means in front of the far plane; ignore points behind the camera
        const w = v.clone().applyMatrix4(cam.matrixWorldInverse)
        if (w.z < 0) {
          front++
          if (c.y < minY) minY = c.y
          if (c.y > maxY) maxY = c.y
          if (c.x < minX) minX = c.x
          if (c.x > maxX) maxX = c.x
        }
      }
      rows.push({ op: +o.material.opacity.toFixed(3), front: front, n: pos.count,
                  ndcY: [+minY.toFixed(2), +maxY.toFixed(2)],
                  ndcX: [+minX.toFixed(2), +maxX.toFixed(2)],
                  el: [+minEl.toFixed(1), +maxEl.toFixed(1)] })
    })
    // frame top/bottom elevation, from the real camera basis
    const fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
    const half = (cam.fov / 2) * Math.PI / 180
    const topDir = fwd.clone().multiplyScalar(Math.cos(half)).add(up.clone().multiplyScalar(Math.sin(half)))
    const botDir = fwd.clone().multiplyScalar(Math.cos(half)).sub(up.clone().multiplyScalar(Math.sin(half)))
    const elOf = d => Math.atan2(d.y, Math.hypot(d.x, d.z)) * 57.2958
    return { aur: +I.aurora().toFixed(2), sky: +I.skyward().toFixed(2), fov: cam.fov,
             frameTopEl: +elOf(topDir).toFixed(1), frameBotEl: +elOf(botDir).toFixed(1),
             camEl: +elOf(fwd).toFixed(1), camY: +cam.position.y.toFixed(2),
             curtains: rows }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3ice5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
