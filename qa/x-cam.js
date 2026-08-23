async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const b = g.capy.body
    b.position.set(-34, 2, -60); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<300;i++) g.tick(1/60,false)
    const c = g.camera
    return { cam:[+c.position.x.toFixed(1),+c.position.y.toFixed(1),+c.position.z.toFixed(1)],
             capy:[+g.capy.position.x.toFixed(1),+g.capy.position.y.toFixed(1),+g.capy.position.z.toFixed(1)],
             swimming: !!g.capy.swimming, yaw: +g.input.camYaw.toFixed(2) }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xcam.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
