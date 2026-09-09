async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    g.biome.switchTo('cave');
  });
  // dark passage, no echo
  await page.evaluate(async () => {
    const g = window.__capy;
    g.capy.body.position.set(6, -3, -84); g.capy.body.velocity.set(0,0,0);
    for (let i=0;i<180;i++) g.tick(1/60,false);
    g.camera.position.set(6, 1.5, -76); g.camera.lookAt(0, 4, -104);
    g.camera.updateMatrixWorld(true); g.post.render();
    await fetch('/shot?name=C7-dark', {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
  });
  // now wheek
  const info = await page.evaluate(async () => {
    const g = window.__capy;
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}));
    g.tick(1/60,false);
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyQ',bubbles:true}));
    for (let i=0;i<10;i++) g.tick(1/60,false);
    g.camera.position.set(6, 1.5, -76); g.camera.lookAt(0, 4, -104);
    g.camera.updateMatrixWorld(true); g.post.render();
    await fetch('/shot?name=C8-echo', {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
    const e1 = g.cave.echo();
    for (let i=0;i<30;i++) g.tick(1/60,false);
    g.camera.updateMatrixWorld(true); g.post.render();
    await fetch('/shot?name=C9-echo2', {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
    return {e1: +e1.toFixed(2), e2: +g.cave.echo().toFixed(2), err: g.state.lastError||null};
  });
  // the doline, from the floor
  await page.evaluate(async () => {
    const g = window.__capy;
    g.capy.body.position.set(4, 2, -48); g.capy.body.velocity.set(0,0,0);
    for (let i=0;i<200;i++) g.tick(1/60,false);
    g.camera.position.set(4, 4, -14); g.camera.lookAt(4, 40, -48);
    g.camera.updateMatrixWorld(true); g.post.render();
    await fetch('/shot?name=CA-doline', {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
    g.camera.position.set(24, 6, -60); g.camera.lookAt(0, 12, -40);
    g.camera.updateMatrixWorld(true); g.post.render();
    await fetch('/shot?name=CB-forest', {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
