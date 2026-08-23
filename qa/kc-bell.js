async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('kyoto'); for (let i=0;i<40;i++) g.tick(1/60,false)
    const k = g.kyoto
    const pick = () => { let m=null; g.scene.traverse(o=>{ if(!m && o.isInstancedMesh && o.count===22 && o.instanceColor) m=o }); return m }
    const glob = () => { let m=null; g.scene.traverse(o=>{ if(!m && o.isInstancedMesh && o.count===40) m=o }); return m }
    const mm=new THREE.Matrix4(), p=new THREE.Vector3(), q=new THREE.Quaternion(), s=new THREE.Vector3()
    const sample = () => {
      const P = pick(), G = glob()
      let py = 0, gx = 0
      if (P) { P.getMatrixAt(0, mm); mm.decompose(p,q,s); py = p.y
               const e = new THREE.Euler().setFromQuaternion(q,'YXZ'); py = Math.round(e.x*1000)/1000 }
      if (G) { G.getMatrixAt(0, mm); mm.decompose(p,q,s); gx = Math.round(p.x*1000)/1000 }
      return { pickPitch: py, globX: gx }
    }
    const before = sample()
    // stand at the rope and pull
    const rope = k.bellRope()
    const b = g.capy.body
    b.position.set(rope.x, rope.y + 0.2, rope.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.actionPressed = true
    for (let i=0;i<3;i++) g.tick(1/60,false)
    g.input.actionPressed = false
    // wind-up is 4.5 s; run past the strike
    let atStrike = null, after = null
    for (let i=0;i<420;i++) { g.tick(1/60,false); if (i===282) atStrike = sample() }
    for (let i=0;i<40;i++) g.tick(1/60,false)
    after = sample()
    return { before, atStrike, after, rang: k.bellRinging() }
  })
  await page.evaluate((o) => fetch('/shot?name=kcbell.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
