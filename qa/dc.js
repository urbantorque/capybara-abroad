async page => {
  const out = await page.evaluate(async () => {
    function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
    const g = window.__capy;
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
    await sleep(800);
    const info = g.renderer.info;
    function measure() {
      info.autoReset = false; info.reset();
      const rt = g.renderer.getRenderTarget();
      g.renderer.render(g.scene, g.camera);
      const r = { calls: info.render.calls, tris: info.render.triangles };
      g.renderer.setRenderTarget(rt); info.autoReset = true;
      return r;
    }
    const withShadow = measure();
    g.renderer.shadowMap.enabled = false;
    const noShadow = measure();
    g.renderer.shadowMap.enabled = true;
    // count visible meshes in the scene
    let vis = 0;
    g.scene.traverse(o => { if (o.isMesh && o.visible) { let p = o.parent, ok = true; while (p) { if (!p.visible) ok = false; p = p.parent; } if (ok) vis++; } });
    return { withShadow, noShadow, visibleMeshes: vis, biome: g.biome.current };
  });
  await page.evaluate(async o => { await fetch('/shot?name=dc.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}); }, out);
}
