async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const r = g.kyoto.bellRope(), b = g.capy.body
    b.position.set(r.x, r.y + 0.2, r.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e')
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    let G = null; g.scene.traverse(o => { if (!G && o.isInstancedMesh && o.count === 40 && o.material && o.material.color && o.material.color.getHex() === 0xf4e7c4) G = o })
    const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
    const xs = []
    if (G) for (let i = 0; i < 5; i++) { G.getMatrixAt(i, mm); mm.decompose(p,q,s); xs.push(Math.round(p.x*1000)/1000) }
    return { ringing: g.kyoto.bellRinging(), xs, found: !!G, n: G ? G.geometry.attributes.position.count : 0 }
  })
  await page.waitForTimeout(4600)
  const at = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    let G = null; g.scene.traverse(o => { if (!G && o.isInstancedMesh && o.count === 40 && o.material && o.material.color && o.material.color.getHex() === 0xf4e7c4) G = o })
    const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
    const xs = []
    if (G) for (let i = 0; i < 5; i++) { G.getMatrixAt(i, mm); mm.decompose(p,q,s); xs.push(Math.round(p.x*1000)/1000) }
    return { ringing: g.kyoto.bellRinging(), xs, err: g.state.lastError }
  })
  await page.evaluate((o) => fetch('/shot?name=kcbell2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { before, at })
}
