async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    const wrap = a => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a }
    const b = g.capy.body
    g.biome.switchTo('drift')
    for (let i=0;i<120;i++) g.tick(1/60,false)
    b.position.set(-38, 80.9, -114); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<180;i++) g.tick(1/60,false)
    const grounded0 = !!g.capy.grounded
    for (let k=0;k<18 && g.drift.lampflies() < 6; k++) {
      down('KeyQ'); for (let i=0;i<3;i++) g.tick(1/60,false); up('KeyQ')
      for (let i=0;i<60;i++) g.tick(1/60,false)
    }
    const flies = g.drift.lampflies()
    b.position.set(24, 108.9, -170); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const grounded1 = !!g.capy.grounded
    b.position.set(34, 108.9, -187); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<90;i++) g.tick(1/60,false)
    down('KeyE'); for (let i=0;i<4;i++) g.tick(1/60,false); up('KeyE')
    for (let i=0;i<30;i++) g.tick(1/60,false)
    b.position.set(24, 108.9, -170); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<40;i++) g.tick(1/60,false)
    const lit = +g.drift.glow().toFixed(2)
    for (let i=0;i<900;i++){ const d = wrap(-0.586 - g.input.camYaw); if (Math.abs(d)<0.03) break
      const k2 = d>0?'KeyZ':'KeyX'; down(k2); g.tick(1/60,false); up(k2) }
    const shots = []
    for (const t of [4, 12, 22, 30]) {
      const want = t*60
      while (shots.length*0 === 0 && false) break
      for (let i=0;i<(t===4?180:t===12?480:t===22?600:480);i++) g.tick(1/60,false)
      g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60,true)
      await fetch('/shot?name=DM-'+t+'.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
      shots.push({ t, glow: +g.drift.glow().toFixed(2), lamps: g.drift.answerLit ? g.drift.answerLit() : null })
    }
    return { grounded0, grounded1, flies, lit, shots, err: g.state.lastError||null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=DM.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
