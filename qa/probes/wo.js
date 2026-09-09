async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400,400); await page.waitForTimeout(1500)
  await page.evaluate(()=>{const g=window.__capy;g.biome.switchTo("kowloon");const b=g.capy.body;b.position.set(0,1.4,34);for(let i=0;i<90;i++)g.tick(1/60,false)})
  const out = await page.evaluate(() => {
    const g = window.__capy
    const V = new g.CANNON.Vec3()
    const hits = []
    for (const bd of g.world.bodies) {
      if (bd.mass > 0 && bd.type !== 4) continue
      for (let si = 0; si < bd.shapes.length; si++) {
        const sh = bd.shapes[si]
        if (!(sh.constructor && sh.constructor.name === 'Box')) continue
        const off = bd.shapeOffsets[si]
        bd.quaternion.vmult(off, V)
        const cx = bd.position.x + V.x, cy = bd.position.y + V.y, cz = bd.position.z + V.z
        const he = sh.halfExtents
        const q = [cx-he.x, cy-he.y, cz-he.z, cx+he.x, cy+he.y, cz+he.z]
        if (q[2] < 28.6 && q[5] > 27.4 && q[0] < -6 && q[3] > -11 && q[1] < 0.9 && q[4] > 0.15) {
          hits.push(q.map(v => +v.toFixed(2)))
        }
      }
    }
    return hits
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wo.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
