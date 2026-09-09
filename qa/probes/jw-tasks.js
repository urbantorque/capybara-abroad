async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.reload(); await page.waitForTimeout(6500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const res = { cave:{}, antarctic:{}, err:null }
    const put = (api, x, z, dy) => {
      const b=g.capy.body, ter=g[api].terrainHeight
      b.position.set(x, ter(x,z)+(dy===undefined?0.5:dy), z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    const hold = (api,x,z,n,dy)=>{ for(let i=0;i<n;i++){ g.tick(1/60,false); put(api,x,z,dy) } }
    // ---------- CAVE ----------
    g.biome.switchTo('cave')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const C=g.cave
    // first-echo: wheek in the dark
    put('cave', 0, 0); hold('cave',0,0,60)
    g.events.emit('capy:wheek'); for(let i=0;i<10;i++) g.tick(1/60,false)
    res.cave['first-echo']=g.taskDone('first-echo')
    // glow-trail: reach the river below z=26
    put('cave', -20, 10); hold('cave',-20,10,90, 6.0)
    res.cave['glow-trail']=g.taskDone('glow-trail')
    // phytokarst
    put('cave', C.phyto.x, C.phyto.z); hold('cave',C.phyto.x,C.phyto.z,90)
    g.events.emit('capy:wheek'); for(let i=0;i<20;i++) g.tick(1/60,false)
    res.cave['phytokarst']=g.taskDone('phytokarst')
    // the-doline
    put('cave', C.doline.x, C.doline.z); hold('cave',C.doline.x,C.doline.z,120)
    res.cave['the-doline']=g.taskDone('the-doline')
    // swiftlets: wheek at the roost
    put('cave', C.roost.x, C.roost.z); hold('cave',C.roost.x,C.roost.z,60)
    g.events.emit('capy:wheek')
    for(let i=0;i<60*6;i++){ g.tick(1/60,false); put('cave',C.roost.x,C.roost.z) }
    res.cave['swiftlets']=g.taskDone('swiftlets')
    // cave-pearl: E in the pearl zone
    put('cave', C.pearls.x, C.pearls.z); hold('cave',C.pearls.x,C.pearls.z,60)
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}))
    for(let i=0;i<8;i++){ g.tick(1/60,false); put('cave',C.pearls.x,C.pearls.z) }
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}))
    for(let i=0;i<8;i++){ g.tick(1/60,false); put('cave',C.pearls.x,C.pearls.z) }
    res.cave['cave-pearl']=g.taskDone('cave-pearl')
    // blind-fish: sit on the fish
    for(let i=0;i<60*30 && !g.taskDone('blind-fish');i++){
      const f=g.cave.fish(); const b=g.capy.body
      b.position.set(f.x, f.y, f.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.tick(1/60,false)
    }
    res.cave['blind-fish']=g.taskDone('blind-fish')
    // the-log: sit on the log
    for(let i=0;i<60*70 && !g.taskDone('the-log');i++){
      const l=g.cave.log(); const b=g.capy.body
      b.position.set(l.x, l.y+0.8, l.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.tick(1/60,false)
    }
    res.cave['the-log']=g.taskDone('the-log')
    // cave-river: swim
    for(let i=0;i<60*40 && !g.taskDone('cave-river');i++){
      const b=g.capy.body
      b.position.set(-20, g.cave.waterLevel-0.1, 20 - (i/60)*3)
      b.velocity.set(0,0,-3)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.tick(1/60,false)
    }
    res.cave['cave-river']=g.taskDone('cave-river')
    // hand-of-dog: put on the tip
    put('cave', C.hand.x, C.hand.z, 27)
    for(let i=0;i<90;i++){ g.tick(1/60,false) }
    res.cave['hand-of-dog']=g.taskDone('hand-of-dog')
    // great-wall: climb — put above the crest
    { const b=g.capy.body
      b.position.set(0, 15.5, -105); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<120;i++) g.tick(1/60,false) }
    res.cave['great-wall']=g.taskDone('great-wall')
    res.cave._err = g.state.lastError||null
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jw.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))})}, out)
}
