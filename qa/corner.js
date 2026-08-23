async page => {
  const out = await page.evaluate(async () => {
    function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
    await sleep(1200);
    g.biome.switchTo('sydney');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const s = g.biome.spawnOf('sydney');
    g.camera.position.set(s.x, s.y + 15, s.z + 30);
    g.camera.lookAt(s.x, s.y + 3.5, s.z - 14);
    g.camera.updateMatrixWorld(true);
    // A: full pipeline
    g.post.render();
    const a = g.renderer.domElement.toDataURL('image/png');
    // B: vignette off
    const v = g.post.params.vignette; g.post.params.vignette = 0;
    g.post.render();
    const b = g.renderer.domElement.toDataURL('image/png');
    g.post.params.vignette = v;
    await fetch('/shot?name=corner-on', {method:'POST', body:a});
    await fetch('/shot?name=corner-off', {method:'POST', body:b});
    return { skyVisible: !!(g.scene.children.find(o=>o.renderOrder===-20) || {}).visible, vig: v };
  });
  await page.evaluate(async o => { await fetch('/shot?name=corner.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}); }, out);
}
