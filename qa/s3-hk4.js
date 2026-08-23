async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    const b = g.capy.body
    b.position.set(0,1.4,-56); b.velocity.set(0,0,0)
    for (let i=0;i<60*82;i++){ g.tick(1/60,false); b.position.set(0,1.4,-56); b.velocity.set(0,0,0) }
    let refl = null
    g.scene.traverse(o => {
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.geometry &&
          o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere()
    })
    const found = []
    g.scene.traverse(o => {
      if (!o.isMesh) return
      if (!o.material || !o.material.transparent) return
      let vis = true; for (let p=o;p;p=p.parent) if(!p.visible) vis=false
      found.push({ vis, op: o.material.opacity, y: o.position.y, ro: o.renderOrder,
                   basic: !!o.material.isMeshBasicMaterial, n: o.geometry.attributes.position.count })
    })
    return { found, lit: g.kowloon.litTowers(), show: g.kowloon.show() }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=hk4.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
