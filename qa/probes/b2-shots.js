async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      const ter = g[q.biome === 'cave' ? 'cave' : 'antarctic'].terrainHeight
      const y = ter(q.px, q.pz) + 1.2
      b.position.set(q.px, y, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (q.yaw !== undefined) g.input.camYaw = q.yaw
      for (let i=0;i<(q.warm||120);i++) {
        g.tick(1/60, false)
        if (q.yaw !== undefined) g.input.camYaw = q.yaw
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760
      g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'cave', px:0, pz:64, yaw:Math.PI, name:'C-cav-spawn.png', warm:200 })
  await cam({ biome:'cave', px:4, pz:38, yaw:Math.PI, name:'C-cav-slope.png' })
  await cam({ biome:'cave', px:8, pz:8, yaw:Math.PI, name:'C-cav-pass.png' })
  await cam({ biome:'cave', px:4, pz:-30, yaw:Math.PI, name:'C-cav-dolapp.png', warm:220 })
  await cam({ biome:'cave', px:4, pz:-48, yaw:Math.PI, name:'C-cav-dolin.png', warm:220 })
  await cam({ biome:'cave', px:-12, pz:-34, yaw:Math.PI, name:'C-cav-phyto.png', warm:200 })
  await cam({ biome:'cave', px:0, pz:-94, yaw:Math.PI, name:'C-cav-wall.png' })
  await cam({ biome:'cave', px:-30, pz:-126, yaw:Math.PI, name:'C-cav-roost.png' })
  await cam({ biome:'cave', px:0, pz:-166, yaw:Math.PI, name:'C-cav-exit.png' })
  await cam({ biome:'antarctic', px:0, pz:52, yaw:Math.PI, name:'D-ant-spawn.png', warm:200 })
  await cam({ biome:'antarctic', px:-17, pz:52, yaw:Math.PI, name:'D-ant-huts.png' })
  await cam({ biome:'antarctic', px:24, pz:100, yaw:0, name:'D-ant-colony.png' })
  await cam({ biome:'antarctic', px:0, pz:36, yaw:Math.PI, name:'D-ant-jetty.png' })
  await cam({ biome:'antarctic', px:-120, pz:-110, yaw:Math.PI*0.5, name:'D-ant-blue.png' })
  await cam({ biome:'antarctic', px:114, pz:22, yaw:Math.PI, name:'D-ant-bones.png' })
  await cam({ biome:'antarctic', px:100, pz:34, yaw:Math.PI*1.4, name:'D-ant-whal.png' })
}
