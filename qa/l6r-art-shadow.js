async page => {
  page.setDefaultNavigationTimeout(120000)
  const out = { rows: [] }
  for (const c of ['sahara', 'venice', 'sydney']) {
    await page.evaluate((c) => window.__capy.hud.cross(c), c)
    await page.waitForTimeout(9000)
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy
      const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow)
      const sc = sun.shadow.camera
      let meshes = 0, casters = 0, inst = 0, instCast = 0, recv = 0
      g.scene.traverse(o => {
        if (o.isInstancedMesh) { inst++; if (o.castShadow) instCast++ }
        else if (o.isMesh) { meshes++; if (o.castShadow) casters++ }
        if ((o.isMesh || o.isInstancedMesh) && o.receiveShadow) recv++
      })
      // the crowd: anything under a group whose name mentions npc / crowd / cast
      let npcCast = 0, npcMesh = 0
      g.scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && /npc|crowd|cast|local|people|person/i.test((o.name || '') + ' ' + (o.parent && o.parent.name || ''))) { npcMesh++; if (o.castShadow) npcCast++ } })
      const rt = g.renderer.getRenderTarget && g.renderer.getRenderTarget()
      return { biome: g.biome.current, shadowMap: sun.shadow.mapSize.x, box: [sc.left, sc.right, sc.top, sc.bottom].map(v => +v.toFixed(0)), near: sc.near, far: sc.far, bias: sun.shadow.bias, normalBias: sun.shadow.normalBias, radius: sun.shadow.radius,
        meshes, casters, inst, instCast, recv, npcMesh, npcCast, shadowType: g.renderer.shadowMap.type, pixelRatio: g.renderer.getPixelRatio(), size: [g.renderer.domElement.width, g.renderer.domElement.height] }
    }))
  }
  await page.evaluate((o) => fetch('/shot?name=l6r-art-shadow.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
