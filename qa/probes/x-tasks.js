async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  // ---- PANTANAL ---------------------------------------------------------
  out.pantanal = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('pantanal')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const done = () => g.state.tasksDone ? Object.keys(g.state.tasksDone) : null
    const b = g.capy.body
    const put = (x,z,y) => { b.position.set(x, y === undefined ? g.pantanal.terrainHeight(x,z)+0.5 : y, z);
      b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    // caiman: stand on the driest one
    const c = g.pantanal.caiman(); const cx=c.x, cy=c.y, cz=c.z
    put(cx, cz, cy + 0.70)
    for (let i=0;i<150;i++) g.tick(1/60,false)
    R.caimanY = +(g.capy.position.y - cy).toFixed(2)
    // otters
    put(g.pantanal.otters.x, g.pantanal.otters.z)
    for (let i=0;i<300;i++) g.tick(1/60,false)
    // cowbird: stand still on dry land
    put(20, 20)
    for (let i=0;i<900;i++) g.tick(1/60,false)
    R.cowbird = (() => { const p = g.pantanal.cowbird(); return [Math.round(p.x), +p.y.toFixed(1), Math.round(p.z)] })()
    R.cowbirdDry = g.pantanal.terrainHeight(g.pantanal.cowbird().x, g.pantanal.cowbird().z) > g.pantanal.waterLevel
    return R
  })
  // ---- CAVE -------------------------------------------------------------
  out.cave = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('cave')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const b = g.capy.body
    const put = (x,z,dy) => { b.position.set(x, g.cave.terrainHeight(x,z)+(dy||0.6), z);
      b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    put(0, 0)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    g.events.emit('capy:wheek', {})
    for (let i=0;i<120;i++) g.tick(1/60,false)
    R.echo = +g.cave.echo().toFixed(2)
    // the doline
    put(g.cave.doline.x, g.cave.doline.z)
    for (let i=0;i<180;i++) g.tick(1/60,false)
    R.daylight = +g.cave.daylight().toFixed(2)
    g.events.emit('capy:wheek', {})
    for (let i=0;i<60;i++) g.tick(1/60,false)
    // the log
    const L = g.cave.log()
    R.log = [Math.round(L.x), +L.y.toFixed(1), Math.round(L.z)]
    return R
  })
  // ---- ANTARCTIC --------------------------------------------------------
  out.antarctic = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('antarctic')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const b = g.capy.body
    // colony chorus
    b.position.set(g.antarctic.colony.x, g.antarctic.terrainHeight(g.antarctic.colony.x, g.antarctic.colony.z)+0.6, g.antarctic.colony.z)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    g.events.emit('capy:wheek', {})
    for (let i=0;i<180;i++) g.tick(1/60,false)
    // haul out on the seal's floe
    const s = g.antarctic.seal()
    b.position.set(s.x + 4.5, g.antarctic.waterLevel + 1.4, s.z + 4.5)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<200;i++) g.tick(1/60,false)
    R.onFloeY = +(g.capy.position.y - g.antarctic.waterLevel).toFixed(2)
    R.swimming = !!g.capy.swimming
    // can we walk THROUGH the seal? push toward its centre
    const before = [g.capy.position.x, g.capy.position.z]
    for (let i=0;i<240;i++) {
      const p = g.capy.position
      const sx = g.antarctic.seal()
      const dx = sx.x - p.x, dz = sx.z - p.z
      const d = Math.hypot(dx,dz) || 1
      g.input.x = 0; g.input.z = 0
      b.velocity.x = dx/d*3; b.velocity.z = dz/d*3
      g.tick(1/60,false)
    }
    const sx = g.antarctic.seal()
    R.distToSealCentre = +Math.hypot(g.capy.position.x - sx.x, g.capy.position.z - sx.z).toFixed(2)
    return R
  })
  const tasks = await page.evaluate(() => {
    const g = window.__capy
    const s = g.state
    const keys = []
    for (const k in s) if (/task/i.test(k)) keys.push(k)
    return { keys, done: (s.done && Array.from(s.done)) || null }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xtasks.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, {out, tasks})
}
