async page => {
  const results = {};

  function readCard() {
    return {
      failed: document.getElementById('boot') ?
        document.getElementById('boot').classList.contains('failed') : null,
      msg: (document.getElementById('failmsg') || {}).textContent || null,
      tips: Array.from(document.querySelectorAll('#failtips li')).map(l => l.textContent),
      detail: (document.getElementById('faildetail') || {}).textContent || null,
      hasButton: !!document.getElementById('failgo'),
      bootVisible: (() => { const b = document.getElementById('boot');
        return !!b && !b.classList.contains('hidden'); })()
    };
  }

  // ---- 1. every external host blocked. Nothing should even notice. --------
  await page.route('**://**', r => {
    const u = r.request().url();
    if (u.indexOf('localhost:5188') === -1) return r.abort();
    return r.continue();
  });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(9000);
  results.offline = await page.evaluate(() => ({
    booted: !!window.__capy, running: !!window.__capyRunning,
    biome: window.__capy && window.__capy.biome && window.__capy.biome.current,
    lastError: window.__capy && window.__capy.state && window.__capy.state.lastError || null
  }));
  await page.unroute('**://**');

  // ---- 2. no WebGL -> a card in words -----------------------------------
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t) {
      if (String(t).indexOf('webgl') === 0) return null;
      return orig.apply(this, arguments);
    };
  });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  results.noWebgl = await page.evaluate(`(${readCard.toString()})()`);

  // ---- 3. a lost GL context mid-play ------------------------------------
  // Same session cannot do it (WebGL is stubbed out above), so this one runs
  // in qa/v52-gl.js against a clean context.

  await page.evaluate(o => fetch('http://localhost:5188/shot?name=v52-verify.json',
    { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), results);
}
