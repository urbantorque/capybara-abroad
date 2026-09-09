async page => {
  await page.evaluate(()=>{try{localStorage.clear()}catch(e){}}).catch(()=>{})
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const done = []
    g.events.on('task:complete', e => done.push(e && e.id))
    g.biome.switchTo('pantanal')
    await new Promise(r=>setTimeout(r,800))
    const c = g.pantanal.caiman(); const cs = { x: c.x, y: c.y, z: c.z }
    const b = g.capy.body
    b.position.set(cs.x, cs.y + 0.9, cs.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.capy.position.set(cs.x, cs.y + 0.9, cs.z)
    for (let i=0;i<60*6;i++) g.tick(1/60,false)
    return { cs, y: +b.position.y.toFixed(2), done,
             saved: localStorage.getItem('capy3.journey.v1'), err: g.state.lastError||null }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=fhcaim3.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o).slice(0,900))))}) }, out)
}
