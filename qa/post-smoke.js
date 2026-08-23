async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
    for (let i=0;i<120;i++) g.tick(1/60,false);
    g.tick(1/60, true);
    const px = new Uint8Array(4);
    const gl = g.renderer.getContext();
    gl.readPixels(640, 380, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { enabled: g.post.enabled, params: g.post.params, centre: Array.from(px),
             err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=post.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))});
  }, out);
  await page.evaluate(async () => {
    const g = window.__capy;
    g.tick(1/60, true);
    await fetch('/shot?name=post-sydney', {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
  });
}
