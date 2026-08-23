async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('quay')
    for (let i=0;i<90;i++) g.tick(1/60,false)
    const q = g.quay, b = g.capy.body, r = {}
    const drop = (x,y,z) => {
      b.position.set(x,y,z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<170;i++) g.tick(1/60,false)
      return { y:+b.position.y.toFixed(2), dx:+(b.position.x-x).toFixed(1),
               dz:+(b.position.z-z).toFixed(1), sw:!!g.capy.swimming, gr:!!g.capy.grounded,
               water:q.isOverWater(x,z), terr:+q.terrainHeight(x,z).toFixed(2) }
    }
    r.openSeaEast   = drop(100, 4, 20)
    r.openSeaEast2  = drop(120, 4, 34)
    r.behindCity    = drop(0, 4, 60.5)
    r.benMidStep    = drop(78, 6, 29)
    r.apron         = drop(0, 4, 30)
    r.apronEastWing = drop(62, 4, 30)
    r.apronWestWing = drop(-62, 4, 40)
    r.wharfDeck     = drop(-28, 4, 6)
    r.bennelong     = drop(78, 6, 22)
    r.benSteps      = drop(78, 8, 30)
    r.manlyWharf    = drop(118, 6, -544)
    r.manlySand     = drop(118, 4, -576)
    r.manlyCove     = drop(118, 4, -600)
    r.fort          = drop(11, 6, -131)
    r.shark         = drop(-46, 8, -268)
    r.brad          = drop(-76, 30, -196)
    r.midSea        = drop(60, 4, -240)
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=cq-phys.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
