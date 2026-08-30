async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    const c = g.canvas || g.renderer.domElement;
    const chunk = T.ShaderChunk.shadowmap_pars_fragment || '';
    // Does the PCF_SOFT branch of three's own shadow chunk mention shadowRadius
    // at all? The per-biome sysBIO_SH_RAD table is written as though it does.
    const iSoft = chunk.indexOf('SHADOWMAP_TYPE_PCF_SOFT');
    const iPcf = chunk.indexOf('SHADOWMAP_TYPE_PCF');
    let softBody = '';
    if (iSoft >= 0) {
      const rest = chunk.slice(iSoft);
      const nextElif = rest.indexOf('#elif', 10);
      softBody = nextElif > 0 ? rest.slice(0, nextElif) : rest.slice(0, 2000);
    }
    let pcfBody = '';
    if (iPcf >= 0 && iPcf !== iSoft) {
      const rest = chunk.slice(iPcf);
      const nextElif = rest.indexOf('#elif', 10);
      pcfBody = nextElif > 0 ? rest.slice(0, nextElif) : rest.slice(0, 2000);
    }
    // ...and prove it on the actual picture. Two radii three orders apart; if
    // the frame is byte-identical the uniform is not reaching the shader.
    const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow);
    const cv = document.createElement('canvas');
    cv.width = c.width; cv.height = c.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    // SYNCHRONOUS CAPTURE. toDataURL is sync; decoding is not, and an await
    // between two renders yields to rAF, which ticks the world. The first
    // version of this probe did exactly that and reported an 11.3% frame
    // difference from a uniform the shader provably never reads -- that was
    // NPCs walking, not shadow radius.
    function grab() { g.post.render(); return c.toDataURL('image/png'); }
    async function decode(url) {
      const im = new Image();
      await new Promise(r => { im.onload = r; im.src = url; });
      cx.drawImage(im, 0, 0);
      return cx.getImageData(0, 0, cv.width, cv.height).data;
    }
    function diff(a, b) {
      let hit = 0, n = 0, peak = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.abs(a[i] - b[i]); n++;
        if (d > 2) hit++;
        if (d > peak) peak = d;
      }
      return { pct: +(100 * hit / n).toFixed(3), peak: peak };
    }
    const res = {};
    const keepR = sun.shadow.radius, keepT = g.renderer.shadowMap.type;
    sun.shadow.radius = 1;  sun.shadow.needsUpdate = true;
    const u1 = grab();
    sun.shadow.radius = 25; sun.shadow.needsUpdate = true;
    const u2 = grab();
    // now the same under plain PCF, which the code's own comment says honours it
    g.renderer.shadowMap.type = T.PCFShadowMap;
    g.scene.traverse(o => { if (o.material) { const m = [].concat(o.material); m.forEach(x => x.needsUpdate = true); } });
    sun.shadow.radius = 1;  sun.shadow.needsUpdate = true;
    const u3 = grab();
    sun.shadow.radius = 25; sun.shadow.needsUpdate = true;
    const u4 = grab();
    res.softRadiusDiff = diff(await decode(u1), await decode(u2));
    res.pcfRadiusDiff = diff(await decode(u3), await decode(u4));
    g.renderer.shadowMap.type = keepT;
    sun.shadow.radius = keepR;
    g.scene.traverse(o => { if (o.material) { const m = [].concat(o.material); m.forEach(x => x.needsUpdate = true); } });
    sun.shadow.needsUpdate = true;
    return {
      shadowType: keepT, radius: keepR,
      mapSize: [sun.shadow.mapSize.x, sun.shadow.mapSize.y],
      frustum: { l: sun.shadow.camera.left, r: sun.shadow.camera.right,
                 t: sun.shadow.camera.top, b: sun.shadow.camera.bottom },
      softMentionsRadius: softBody.indexOf('shadowRadius') >= 0,
      pcfMentionsRadius: pcfBody.indexOf('shadowRadius') >= 0,
      softTapCount: (softBody.match(/texture2DCompare|texture2DDistribution/g) || []).length,
      pcfTapCount: (pcfBody.match(/texture2DCompare/g) || []).length,
      res: res,
      err: g.state.lastError || null,
    };
  });
  await page.evaluate(o => fetch('/shot?name=shadowprobe.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
