async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['pan-spawn', 'pantanal', 0, 3, 62, 0],
    ['pan-baia', 'pantanal', -40, 2, 10, 0],
    ['pan-fazenda', 'pantanal', 22, 4, 74, 0],
    ['pan-river', 'pantanal', -34, 2, -60, 0],
    ['pan-nest', 'pantanal', 44, 2, 12, 0],
  ]
  for (const s of shots) {
    await page.evaluate((a) => {
      const g = window.__capy
      if (g.biome.current !== a[1]) g.biome.switchTo(a[1])
      const b = g.capy.body
      b.position.set(a[2], a[3], a[4]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = a[5]
    }, s)
    await page.waitForTimeout(2600)
    await page.evaluate(async (name) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + name, { method:'POST', body: d })
    }, s[0])
  }
}
