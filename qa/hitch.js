async page => {
  const out = await page.evaluate(async () => {
    function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
    const g = window.__capy;
    g.renderer.setSize(1600, 900, false);
    g.camera.aspect = 1600/900; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
    await sleep(1000);
    const names = ['pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','sydney'];
    const worst = {};
    for (const n of names) {
      let mx = 0, last = performance.now(), frames = 0;
      let stop = false;
      function step(t){ const d = t - last; last = t; if (frames++ > 2 && d > mx) mx = d; if (!stop) requestAnimationFrame(step); }
      requestAnimationFrame(step);
      await sleep(80);
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0,0,0);
      await sleep(2200);
      stop = true;
      worst[n] = +mx.toFixed(1);
    }
    return { worst, programs: g.renderer.info.programs.length };
  });
  await page.evaluate(async o => { await fetch('/shot?name=hitch.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}); }, out);
}
