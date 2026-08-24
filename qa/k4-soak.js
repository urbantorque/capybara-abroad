async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['cave','antarctic']) {
    await page.evaluate((name)=>{ const g=window.__capy
      g.biome.switchTo(name); g.state.lastError=null
      const sp=g.biome.spawnOf(name), b=g.capy.body
      b.position.set(sp.x,sp.y,sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, n)
    // REAL TIME: rAF drives the game, keys are trusted, audio is unlocked
    const KEYS=['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft','KeyF']
    for (let r=0;r<26;r++){
      const k = KEYS[(r*7)%KEYS.length]
      await page.keyboard.down(k)
      await page.waitForTimeout(900)
      await page.keyboard.up(k)
    }
    out[n] = await page.evaluate(()=>{ const g=window.__capy
      const p=g.capy.position
      return { err:g.state.lastError||null, at:[+p.x.toFixed(1),+p.y.toFixed(2),+p.z.toFixed(1)],
               finite: isFinite(p.x)&&isFinite(p.y)&&isFinite(p.z) } })
  }
  await page.evaluate(async (o)=>{await fetch('/shot?name=k4.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
