async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    const res = {}
    for (const n of ['drift','sydney','venice']) {
      g.biome.switchTo(n)
      for (let i=0;i<60;i++) g.tick(1/60,false)
      const f = []
      g.scene.traverse(o => {
        if (o.isGroup && o.children.length === 7 && o.parent === g.scene)
          f.push({ p:[Math.round(o.position.x),Math.round(o.position.y),Math.round(o.position.z)], v:o.visible })
      })
      res[n] = { n: f.length, visible: f.filter(q=>q.v).length, sample: f.slice(0,4) }
    }
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=t4loc2.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
