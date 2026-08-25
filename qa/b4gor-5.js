async page => {
  const o = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    let sun = null
    g.scene.traverse(n => { if (n.isMesh && Math.abs(n.position.x - 760) < 1 && Math.abs(n.position.z + 70) < 1 && !sun) sun = n })
    if (!sun) return { err: 'no sun mesh' }
    const v = new T.Vector3()
    const cam = g.camera
    cam.updateMatrixWorld(true); cam.updateProjectionMatrix()
    v.setFromMatrixPosition(sun.matrixWorld).project(cam)
    return { sunY: sun.position.y, ndc: [v.x, v.y, v.z], fov: cam.fov, aspect: cam.aspect,
             sunUp: g.goreme.sunUp(), camPos: [g.camera.position.x, g.camera.position.y, g.camera.position.z],
             vis: sun.visible }
  })
  await page.evaluate(async q => { await fetch('/shot?name=b4gor-5.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(q))))}) }, o)
}
