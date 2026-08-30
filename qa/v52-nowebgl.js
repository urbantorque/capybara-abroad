async page => {
  // What a machine with no WebGL (old driver, blocklisted GPU, VM, some Linux
  // laptops, hardware acceleration switched off in Chrome) actually sees.
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (String(type).indexOf('webgl') === 0) return null;
      return orig.apply(this, arguments);
    };
  });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(8000);

  const out = await page.evaluate(() => {
    const boot = document.getElementById('boot');
    const err = document.getElementById('err');
    return {
      scenario: 'no webgl',
      bootStillUp: !!boot && !boot.classList.contains('hidden'),
      bootText: boot ? boot.innerText.replace(/\s+/g, ' ').trim() : null,
      errShown: err ? getComputedStyle(err).display !== 'none' : null,
      errText: err ? err.textContent.replace(/\s+/g, ' ').slice(0, 260) : null,
      hasGame: !!window.__capy
    };
  });

  await page.evaluate(o => fetch('/shot?name=v52-nowebgl.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
