async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const b = g.capy.body
    g.biome.switchTo('kowloon')
    b.position.set(-10.5, 35.4, 0); b.velocity.set(0,0,0)
    const hold = (n) => { for(let i=0;i<n;i++){ g.tick(1/60,false); b.position.set(-10.5,35.4,0); b.velocity.set(0,0,0) } }
    const rows = []
    hold(60*80)
    for (let k=0;k<44;k++) {
      hold(60*1)
      const t = g.scene.children
      // read the tower materials through the biome api if exposed, else scan
      let em = []
      g.scene.traverse(o => { if (o.isMesh && o.material && o.material.emissiveIntensity !== undefined && o.userData && o.userData.hkTower !== undefined) em[o.userData.hkTower] = +o.material.emissiveIntensity.toFixed(2) })
      rows.push({ s: k, show: +g.kowloon.show().toFixed(2), em: em.length ? em.join(',') : 'n/a' })
    }
    return rows
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4show2.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
