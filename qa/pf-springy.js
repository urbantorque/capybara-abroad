async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    for (let i = 0; i < 60 * 16; i++) g.tick(1 / 60, false)
    const ice = g.iceland
    const wy = ice && ice.waterY ? ice.waterY(-40, -10) : null
    // where is the drawn model, and where is its top?
    const box = new g.THREE.Box3().setFromObject(g.capy.group)
    return { loaf: +g.capy.loaf.toFixed(2), swimming: !!g.capy.swimming,
             bodyY: +g.capy.position.y.toFixed(3),
             waterY: wy === null ? null : +wy.toFixed(3),
             modelTop: +box.max.y.toFixed(3), modelBot: +box.min.y.toFixed(3),
             proud: wy === null ? null : +(box.max.y - wy).toFixed(3),
             api: ice ? Object.keys(ice) : null }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=pfspringy.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
