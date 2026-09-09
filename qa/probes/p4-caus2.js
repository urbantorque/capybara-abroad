async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('palawan')
    const b = g.capy.body
    b.position.set(-13, -3, 4); b.velocity.set(0,0,0)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const rows = []
    g.scene.traverse(o => {
      if (o.name !== 'palCaustics') return
      const a = o.geometry.attributes.color.array
      let n=0, sum=0, mx=0, hi=0
      for (let i=3;i<a.length;i+=4){ n++; sum+=a[i]; if(a[i]>mx)mx=a[i]; if(a[i]>0.4)hi++ }
      rows.push({ n, mean:+(sum/n).toFixed(3), max:+mx.toFixed(3), pctOver04:+(100*hi/n).toFixed(1) })
    })
    return rows
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p4caus2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
